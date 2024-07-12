
const express = require('express');
const compression = require('compression');
const app = express();

const cosmosEndpoint = process.env.CosmosEndpoint;
const cosmosDatabaseId = process.env.CosmosDatabaseId;
const cosmosContainerId = process.env.CosmosContainerId;

console.log(`Starting server with Cosmos DB endpoint: ${cosmosEndpoint}, databaseId: ${cosmosDatabaseId}, containerId: ${cosmosContainerId}`);

const CosmosDBReader = require('./scripts/cosmos-db-reader.js');
const cosmosDBReader = new CosmosDBReader(cosmosEndpoint, cosmosDatabaseId, cosmosContainerId);

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

// Existing routes

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
