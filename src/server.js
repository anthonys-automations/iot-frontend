const express = require('express');
const compression = require('compression');
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
  const source = req.query.source;
  const month = req.query.month;
  try {
    console.log(`Fetching device details for source: ${source} and month: ${month}`);
    const details = await cosmosDBReader.getDeviceDetails(source, month);
    if (!details || details.length === 0) {
      console.error(`No details found for source: ${source} and month: ${month}`);
    }
    res.json(details);
  } catch (error) {
    console.error(`Error fetching details for source: ${source} and month: ${month} - ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/device-months', async (req, res) => {
  const source = req.query.source;
  const months = await cosmosDBReader.getDistinctMonths(source);
  res.json(months);
});

app.get('/api/current-user', async (req, res) => {
    // Extract Azure AD claims from headers
    const clientPrincipal = req.headers['x-ms-client-principal'];
    
    if (!clientPrincipal) {
        console.log('No client principal found in headers');
        return res.json({ 
            authenticated: false,
            authType: 'azure'
        });
    }

    try {
        // Decode the client principal (it's base64 encoded)
        const principal = JSON.parse(Buffer.from(clientPrincipal, 'base64').toString('ascii'));
        
        console.log('Decoded principal:', principal);
        
        // The userId is in the claims
        const authId = principal.userId;
        const authType = 'azure';

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
            // When no user found, return auth info for signup
            res.json({ 
                authenticated: false, 
                authType, 
                authId 
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
