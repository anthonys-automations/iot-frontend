// __tests__/CosmosDBReader.test.js

jest.mock('../src/scripts/auth', () => ({
    createCosmosClient: jest.fn()
}));
  
const { createCosmosClient } = require('../src/scripts/auth');
const CosmosDBReader = require('../src/scripts/cosmos-db-reader');

describe('CosmosDBReader', () => {
    let dbReader;
    let mockDatabase;
    let mockContainer;
    let mockQuery;
    let mockFetchAll;

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up mock chain
        mockFetchAll = jest.fn();
        mockQuery = jest.fn().mockReturnValue({ fetchAll: mockFetchAll });
        mockContainer = { items: { query: mockQuery } };
        mockDatabase = { container: jest.fn().mockReturnValue(mockContainer) };
        
        // Set up the createCosmosClient mock
        createCosmosClient.mockReturnValue({
            database: jest.fn().mockReturnValue(mockDatabase)
        });

        dbReader = new CosmosDBReader('fake-endpoint', 'fake-db', 'fake-container');
    });

    describe('getDeviceDetails', () => {
        it('should fetch last 60 days of data on initial load when no times provided', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: new Array(50).fill({ 
                    Body: { paramA: 123 }, 
                    SystemProperties: { "iothub-enqueuedtime": new Date().toISOString() } 
                })
            });

            const result = await dbReader.getDeviceDetails('my-source', 'paramA');
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(result.data.length).toBe(50);
            expect(result.suggestedRange).toBeDefined();
        });

        it('should fetch all time if under 30 items were found initially', async () => {
            // First call returns few items
            mockFetchAll.mockResolvedValueOnce({
                resources: [{ 
                    Body: { paramA: 123 }, 
                    SystemProperties: { "iothub-enqueuedtime": new Date().toISOString() } 
                }]
            });

            // Second call returns all-time data
            mockFetchAll.mockResolvedValueOnce({
                resources: new Array(30).fill({ 
                    Body: { paramA: 123 }, 
                    SystemProperties: { "iothub-enqueuedtime": new Date().toISOString() } 
                })
            });

            const result = await dbReader.getDeviceDetails('my-source', 'paramA');
            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(result.data.length).toBe(30);
            expect(result.suggestedRange).toBeDefined();
        });

        it('should handle subsequent requests with start/end times', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: [{
                    Body: { paramA: 999 },
                    SystemProperties: { "iothub-enqueuedtime": new Date().toISOString() }
                }]
            });

            const start = new Date('2021-01-01').toISOString();
            const end = new Date('2021-01-31').toISOString();
            const result = await dbReader.getDeviceDetails('src', 'paramA', start, end);

            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(result.data[0].Body.paramA).toBe(999);
        });

        it('should throw if the query fails', async () => {
            mockFetchAll.mockRejectedValueOnce(new Error('Query error'));
            await expect(dbReader.getDeviceDetails('src', 'paramA')).rejects.toThrow('Query error');
        });
    });

    describe('getDistinctMonths', () => {
        it('should return distinct months', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: [{ month: '2021-01' }, { month: '2020-12' }]
            });

            const months = await dbReader.getDistinctMonths('my-source');
            expect(mockQuery).toHaveBeenCalledWith({
                query: 'SELECT DISTINCT c.month FROM c WHERE c.source = @source ORDER BY c.month DESC',
                parameters: [{ name: '@source', value: 'my-source' }]
            });
            expect(months).toEqual(['2021-01', '2020-12']);
        });

        it('should throw if query fails', async () => {
            mockFetchAll.mockRejectedValueOnce(new Error('Query fail'));
            await expect(dbReader.getDistinctMonths('any')).rejects.toThrow('Query fail');
        });
    });

    describe('getDeviceParameters', () => {
        it('should return sorted distinct parameters found in device data', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: [
                    { Body: { paramA: 1, paramZ: 2, Utc: 'ignored' } },
                    { Body: { paramB: 3 } }
                ]
            });

            const params = await dbReader.getDeviceParameters('src');
            expect(params).toEqual(['paramA', 'paramB', 'paramZ']);
        });

        it('should throw if query fails', async () => {
            mockFetchAll.mockRejectedValueOnce(new Error('Query error'));
            await expect(dbReader.getDeviceParameters('src')).rejects.toThrow('Query error');
        });
    });

    describe('getDevices', () => {
        it('should return an array of device sources', async () => {
            mockFetchAll.mockResolvedValueOnce({
                resources: [
                    { source: 'device1' },
                    { source: 'device2' },
                    {} // filtered out
                ]
            });

            const devices = await dbReader.getDevices();
            expect(devices).toEqual(['device1', 'device2']);
        });

        it('should throw if query fails', async () => {
            mockFetchAll.mockRejectedValueOnce(new Error('Query fail'));
            await expect(dbReader.getDevices()).rejects.toThrow('Query fail');
        });
    });
});
  