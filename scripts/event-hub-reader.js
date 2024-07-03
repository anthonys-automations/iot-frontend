/*
 * Microsoft Sample Code - Copyright (c) 2020 - Licensed MIT
 */

const { EventHubProducerClient, EventHubConsumerClient } = require('@azure/event-hubs');
const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');

const http_proxy = process.env.http_proxy;
const proxyAgent = new HttpsProxyAgent(http_proxy);

class EventHubReader {
  constructor(eventHubConnectionString, consumerGroup) {
    this.eventHubConnectionString = eventHubConnectionString;
    this.consumerGroup = consumerGroup;
  }

  async startReadMessage(startReadMessageCallback) {
    try {
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

      const consumerClient = new EventHubConsumerClient(this.consumerGroup, this.eventHubConnectionString, clientOptions);
      console.log('Successfully created the EventHubConsumerClient from IoT Hub event hub-compatible connection string.');

      const partitionIds = await consumerClient.getPartitionIds();
      console.log('The partition ids are: ', partitionIds);

      consumerClient.subscribe({
        processEvents: (events, context) => {
          for (let i = 0; i < events.length; ++i) {
            startReadMessageCallback(
              events[i].body,
              events[i].enqueuedTimeUtc,
              events[i].systemProperties["iothub-connection-device-id"]);
          }
        },
        processError: (err, context) => {
          console.error(err.message || err);
        }
      });
    } catch (ex) {
      console.error(ex.message || ex);
    }
  }

  // Close connection to Event Hub.
  async stopReadMessage() {
    const disposeHandlers = [];
    this.receiveHandlers.forEach((receiveHandler) => {
      disposeHandlers.push(receiveHandler.stop());
    });
    await Promise.all(disposeHandlers);

    this.consumerClient.close();
  }
}

module.exports = EventHubReader;
