const express = require('express');
const compression = require('compression');
const Joi = require('joi');
const app = express();

const cosmosEndpoint = process.env.CosmosEndpoint;
const cosmosDatabaseId = process.env.CosmosDatabaseId;
const cosmosContainerId = "telemetry";

console.log(`Starting server with Cosmos DB endpoint: ${cosmosEndpoint}, databaseId: ${cosmosDatabaseId}, containerId: ${cosmosContainerId}`);

const CosmosDBReader = require('./scripts/cosmos-db-reader.js');
const cosmosDBReader = new CosmosDBReader(cosmosEndpoint, cosmosDatabaseId, cosmosContainerId);

const UsersDBReader = require('./scripts/users-db-reader.js');
const usersDBReader = new UsersDBReader(cosmosEndpoint, cosmosDatabaseId);

const path = require('path');
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// Define validation schemas
const deviceDetailsSchema = Joi.object({
    source: Joi.string().required(),
    parameter: Joi.string().required(),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso().when('startTime', {
        is: Joi.exist(),
        then: Joi.date().iso().required(),
        otherwise: Joi.forbidden()
    })
});

const deviceParametersSchema = Joi.object({
    source: Joi.string().required()
});

app.get('/api/devices', async (req, res) => {
  try {
      const data = await cosmosDBReader.getDeviceSources();
      res.json(data);
  } catch (error) {
      console.error(`Error in /api/devices: ${error.message}`);
      res.status(500).json({ error: error.message });
  }
});

app.get('/api/device-details', async (req, res) => {
    try {
        const { source, parameter } = req.query;
        let { startTime, endTime } = req.query;
        
        // Add type checking for dates
        if (startTime && !isNaN(new Date(startTime).getTime()) && 
            endTime && !isNaN(new Date(endTime).getTime())) {
            const { error } = deviceDetailsSchema.validate({ 
                source, parameter, startTime, endTime 
            });
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
        } else if (startTime || endTime) {
            // If one of the dates is invalid
            return res.status(400).json({ error: 'Invalid date format provided' });
        }
        
        const data = await cosmosDBReader.getDeviceDetails(
            source, 
            parameter, 
            startTime, 
            endTime
        );
        
        // Add null check for response data
        if (!data || !data.data) {
            return res.status(404).json({ error: 'No data found' });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching device details:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/device-months', async (req, res) => {
  const source = req.query.source;
  const months = await cosmosDBReader.getDistinctMonths(source);
  res.json(months);
});

app.get('/api/current-user', async (req, res) => {
    const clientPrincipal = req.headers['x-ms-client-principal'];
    
    if (!clientPrincipal) {
        console.log('No client principal found in headers');
        return res.json({ 
            authenticated: false,
            authType: 'azure'
        });
    }

    try {
        const principal = JSON.parse(Buffer.from(clientPrincipal, 'base64').toString('ascii'));
        console.log('Decoded principal:', principal);
        
        // Extract user information from claims
        const objectIdClaim = principal.claims.find(
            claim => claim.typ === 'http://schemas.microsoft.com/identity/claims/objectidentifier'
        );
        const emailClaim = principal.claims.find(
            claim => claim.typ === 'preferred_username'
        );
        const nameClaim = principal.claims.find(
            claim => claim.typ === 'name'
        );

        const authId = objectIdClaim?.val;
        const authType = 'azure';
        const email = emailClaim?.val;
        const name = nameClaim?.val;

        console.log('Extracted user info:', { authId, email, name });

        if (!authId) {
            return res.json({ 
                authenticated: false,
                authType
            });
        }

        const user = await usersDBReader.findUserByAuth(authType, authId);
        if (user) {
            res.json({ authenticated: true, user });
        } else {
            // When no user found, return auth info and additional user info for signup
            res.json({ 
                authenticated: false, 
                authType, 
                authId,
                suggestedEmail: email,
                suggestedName: name
            });
        }
    } catch (error) {
        console.error('Error processing authentication:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/signup', express.json(), async (req, res) => {
    const { realName, emailAddress, authType, authId } = req.body;
    
    if (!emailAddress) {
        return res.status(400).json({ error: 'Email address is required' });
    }

    try {
        const user = await usersDBReader.createUser(realName, emailAddress, authType, authId);
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/device-parameters', async (req, res) => {
    // Validate the query parameters
    const { error, value } = deviceParametersSchema.validate(req.query);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const { source } = value;
    try {
        const parameters = await cosmosDBReader.getDeviceParameters(source);
        res.json(parameters);
    } catch (error) {
        console.error(`Error fetching parameters for source: ${source}`, error);
        res.status(500).json({ error: error.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
