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

    async getDeviceDetails(source, parameter, startTime = null, endTime = null) {
        try {
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            
            let query;
            
            // Format parameter path for Cosmos DB query
            // This handles parameters with spaces like "body weight" -> c.Body["body weight"]
            const parameterPath = `c.Body["${parameter}"]`;
            
            if (!startTime || !endTime) {
                // Initial load - try last 60 days first
                const now = new Date();
                const sixtyDaysAgo = new Date(now);
                sixtyDaysAgo.setDate(now.getDate() - 60);
                
                query = {
                    query: `
                        SELECT TOP 1000
                            c.SystemProperties["iothub-enqueuedtime"] as timestamp,
                            c.Body
                        FROM c 
                        WHERE 
                            c.Properties.source = @source 
                            AND c.SystemProperties["iothub-enqueuedtime"] >= @startTime
                            AND IS_DEFINED(${parameterPath})
                        ORDER BY c.SystemProperties["iothub-enqueuedtime"] DESC
                    `,
                    parameters: [
                        { name: '@source', value: source },
                        { name: '@startTime', value: sixtyDaysAgo.toISOString() }
                    ]
                };
                
                const { resources: items } = await container.items.query(query).fetchAll();
                
                // If we got less than 30 points, query for last 30 points across all time
                if (items.length < 30) {
                    query = {
                        query: `
                            SELECT TOP 30
                                c.SystemProperties["iothub-enqueuedtime"] as timestamp,
                                c.Body
                            FROM c 
                            WHERE 
                                c.Properties.source = @source
                                AND IS_DEFINED(${parameterPath})
                            ORDER BY c.SystemProperties["iothub-enqueuedtime"] DESC
                        `,
                        parameters: [{ name: '@source', value: source }]
                    };
                    const { resources: limitedItems } = await container.items.query(query).fetchAll();
                    
                    if (!limitedItems || limitedItems.length === 0) {
                        return {
                            data: [],
                            suggestedRange: {
                                start: new Date(),
                                end: new Date()
                            }
                        };
                    }
                    
                    return {
                        data: limitedItems.reverse(),
                        suggestedRange: {
                            start: new Date(limitedItems[0].timestamp),
                            end: new Date(limitedItems[limitedItems.length - 1].timestamp)
                        }
                    };
                }
                
                // We got enough data, suggest 30 days range but return 60 days of data
                const thirtyDaysAgo = new Date(now);
                thirtyDaysAgo.setDate(now.getDate() - 30);
                
                return {
                    data: items.reverse(),
                    suggestedRange: {
                        start: thirtyDaysAgo,
                        end: now
                    }
                };
            } else {
                // For subsequent requests with time range
                const start = new Date(startTime);
                const end = new Date(endTime);
                const timeRange = end - start;
                
                const extendedStart = new Date(start.getTime() - timeRange);
                const extendedEnd = new Date(end.getTime() + timeRange);
                
                query = {
                    query: `
                        SELECT 
                            c.SystemProperties["iothub-enqueuedtime"] as timestamp,
                            c.Body
                        FROM c 
                        WHERE 
                            c.Properties.source = @source 
                            AND c.SystemProperties["iothub-enqueuedtime"] >= @startTime 
                            AND c.SystemProperties["iothub-enqueuedtime"] <= @endTime
                            AND IS_DEFINED(${parameterPath})
                        ORDER BY c.SystemProperties["iothub-enqueuedtime"] ASC
                    `,
                    parameters: [
                        { name: '@source', value: source },
                        { name: '@startTime', value: extendedStart.toISOString() },
                        { name: '@endTime', value: extendedEnd.toISOString() }
                    ]
                };
                
                const { resources: items } = await container.items.query(query).fetchAll();
                return { data: items };
            }
            
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

    async getDevices() {
        try {
            console.log('Connecting to database...');
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            
            const query = {
                query: 'SELECT DISTINCT c.Properties.source FROM c'
            };
            
            const { resources: items } = await container.items.query(query).fetchAll();
            
            // Add validation and transformation
            if (!items || !Array.isArray(items)) {
                console.error('Invalid response from database:', items);
                return [];
            }
            
            // Transform and filter out any invalid entries
            const devices = items
                .filter(item => item && item.source)
                .map(item => item.source);
                
            console.log('Devices retrieved:', devices);
            return devices;
            
        } catch (error) {
            console.error('Error in getDevices:', error);
            throw error;
        }
    }
}

module.exports = CosmosDBReader;
