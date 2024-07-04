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

app.get('/api/telemetry', async (req, res) => {
    try {
        console.log(`Received request for /api/telemetry`);
        const data = await cosmosDBReader.getItems();
        const formattedData = data.map(item => ({
            properties: item.properties,
            timestamp: item.timestamp,
            ...item.body
        }));
        console.log(`Sending response with data: ${JSON.stringify(data, null, 2)}`);
        res.json(data);
    } catch (error) {
        console.error(`Error in /api/telemetry: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
