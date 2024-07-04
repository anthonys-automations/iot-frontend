const express = require('express');
const path = require('path');
const CosmosDBReader = require('./scripts/cosmos-db-reader.js');

const cosmosEndpoint = process.env.CosmosEndpoint;
const cosmosDatabaseId = process.env.CosmosDatabaseId;
const cosmosContainerId = process.env.CosmosContainerId;

console.log(`Starting server with Cosmos DB endpoint: ${cosmosEndpoint}, databaseId: ${cosmosDatabaseId}, containerId: ${cosmosContainerId}`);

const app = express();
const cosmosDBReader = new CosmosDBReader(cosmosEndpoint, cosmosDatabaseId, cosmosContainerId);

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
  try {
      const source = req.query.source;
      const data = await cosmosDBReader.getDeviceDetails(source);
      res.json(data);
  } catch (error) {
      console.error(`Error in /api/device-details: ${error.message}`);
      res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
