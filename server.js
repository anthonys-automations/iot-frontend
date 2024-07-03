const express = require('express');
const path = require('path');
const EventHubReader = require('./scripts/event-hub-reader.js');
var eventHubConnectionString = process.env.EventHubConnectionString;
const eventHubConsumerGroup = process.env.EventHubConsumerGroup;
console.log(eventHubConsumerGroup);
if (!eventHubConsumerGroup) {
  console.error(`Environment variable EventHubConsumerGroup must be specified.`);
  return;
}
console.log(`Using event hub consumer group [${eventHubConsumerGroup}]`);
const app = express();
const eventHubReader = new EventHubReader(eventHubConnectionString, eventHubConsumerGroup);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/telemetry', async (req, res) => {
    const data = await eventHubReader.getMessages();
    res.json(data);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
