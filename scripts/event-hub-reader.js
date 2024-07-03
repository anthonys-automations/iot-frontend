const { EventHubConsumerClient, earliestEventPosition } = require('@azure/event-hubs');
const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');

const http_proxy = process.env.http_proxy;
const proxyAgent = new HttpsProxyAgent(http_proxy);

class EventHubReader {
    constructor(eventHubConnectionString, consumerGroup) {
        this.eventHubConnectionString = eventHubConnectionString;
        this.consumerGroup = consumerGroup;
    
        var clientOptions = {};
        if (http_proxy) {
          console.log(`Using proxy server at [${http_proxy}]`);
        
          clientOptions = {
            webSocketOptions: {
              webSocket: WebSocket,
              webSocketConstructorOptions: { agent: proxyAgent }
            }
          };
        }
    
        this.client = new EventHubConsumerClient(this.consumerGroup, this.eventHubConnectionString, clientOptions);
    }

    async getMessages() {
        const receivedEvents = [];
        const subscription = this.client.subscribe({
            startPosition: earliestEventPosition, // Start from the earliest available event
            processEvents: async (events) => {
                console.log('Processing events:', events.length); // Log the number of events processed
                for (const event of events) {
                    const message = {
                        properties: event.properties,
                        ...event.body,
                        timestamp: event.enqueuedTimeUtc
                    };
                    receivedEvents.push(message);
                }
            },
            processError: async (err) => {
                console.error(err);
            }
        });

        // Wait a bit for events to be received
        await new Promise(resolve => setTimeout(resolve, 20000)); // Increase wait time if needed
        await subscription.close();

        console.log('Total events received:', receivedEvents.length); // Log the total number of events received
        return receivedEvents;
    }
}

module.exports = EventHubReader;
