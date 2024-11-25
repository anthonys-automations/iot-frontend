const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { HttpsProxyAgent } = require('https-proxy-agent');

class CosmosDBReader {
    constructor(endpoint, databaseId, containerId) {
        let proxyAgent = null;
        if (process.env.http_proxy) {
          const http_proxy = process.env.http_proxy;
          proxyAgent = new HttpsProxyAgent(http_proxy);
        }

        this.client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            aadCredentials: new DefaultAzureCredential()
        });
        this.databaseId = databaseId;
        this.containerId = containerId;
    }

    async getDeviceSources() {
        try {
            console.log(`Fetching device sources from database: ${this.databaseId}, container: ${this.containerId}`);
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            const { resources: items } = await container.items.query('SELECT DISTINCT c.source FROM c ORDER BY c.source').fetchAll();
            console.log(`Fetched device sources: ${JSON.stringify(items, null, 2)}`);
            return items;
        } catch (error) {
            console.error(`Error fetching device sources: ${error.message}`);
            throw error;
        }
    }

    async getDeviceDetails(source, parameter, startTime, endTime) {
        try {
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            
            // Convert string dates to ISO format if they aren't already
            const start = new Date(startTime).toISOString();
            const end = new Date(endTime).toISOString();
            
            const query = {
                query: `
                    SELECT 
                        c.SystemProperties["iothub-enqueuedtime"] as timestamp,
                        c.Body
                    FROM c 
                    WHERE 
                        c.Properties.source = @source 
                        AND c.SystemProperties["iothub-enqueuedtime"] >= @startTime 
                        AND c.SystemProperties["iothub-enqueuedtime"] <= @endTime
                    ORDER BY c.SystemProperties["iothub-enqueuedtime"] ASC
                `,
                parameters: [
                    { name: '@source', value: source },
                    { name: '@startTime', value: start },
                    { name: '@endTime', value: end }
                ]
            };
            
            const { resources: items } = await container.items.query(query).fetchAll();
            console.log(`Found ${items.length} data points for ${source}`); // Debug log
            return items;
            
        } catch (error) {
            console.error(`Error fetching details: ${error.message}`);
            throw error;
        }
    }

    async getDistinctMonths(source) {
        try {
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            const query = {
                query: 'SELECT DISTINCT c.month FROM c WHERE c.source = @source ORDER BY c.month DESC',
                parameters: [{ name: '@source', value: source }]
            };
            const { resources: items } = await container.items.query(query).fetchAll();
            return items.map(item => item.month);
        } catch (error) {
            console.error(`Error fetching months for source ${source}: ${error.message}`);
            throw error;
        }
    }

    async getDeviceParameters(source) {
        try {
            console.log(`Fetching parameters for source: ${source}`);
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);

            const query = {
                query: 'SELECT c.Body FROM c WHERE c.Properties.source = @source',
                parameters: [{ name: '@source', value: source }]
            };

            const { resources } = await container.items.query(query).fetchAll();
            
            const parameterSet = new Set();
            resources.forEach(item => {
                if (item.Body) {
                    Object.keys(item.Body).forEach(key => {
                        if (key !== 'Utc') {
                            parameterSet.add(key);
                        }
                    });
                }
            });

            const parameters = Array.from(parameterSet).sort();
            console.log('Found parameters:', parameters);
            return parameters;

        } catch (error) {
            console.error(`Error fetching parameters for source ${source}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = CosmosDBReader;
