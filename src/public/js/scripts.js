async function checkAuth() {
    try {
        console.log('Checking authentication...');
        const response = await fetch('/api/current-user');
        const data = await response.json();
        
        console.log('Auth check response:', data);

        if (data.authenticated) {
            console.log('User is authenticated:', data.user);
            const topBar = document.querySelector('.top-bar');
            topBar.innerHTML = `Telemetry Dashboard - Hello ${sanitizeHTML(data.user.realName || data.user.emailAddress)}`;
        } else if (data.authId) {
            console.log('User needs to sign up, redirecting...');
            const params = new URLSearchParams({
                authType: data.authType,
                authId: data.authId,
                email: data.suggestedEmail || '',
                name: data.suggestedName || ''
            });
            window.location.href = `/signup.html?${params.toString()}`;
        } else {
            console.log('No authentication credentials found');
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    fetchDevices();
});

async function fetchDevices() {
  try {
    const response = await fetch('/api/devices');
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`);
    }
    const devices = await response.json();
    displayDevices(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    const deviceList = document.getElementById('device-list');
    deviceList.innerHTML = `
      <div class="error-message">
        Unable to load devices. Please try again later.
      </div>
    `;
  }
}

async function displayDevices(devices) {
    try {
        const deviceList = document.getElementById('device-list');
        deviceList.innerHTML = '';

        if (!devices || !Array.isArray(devices)) {
            throw new Error('Invalid devices data received');
        }

        // Create hierarchical list
        for (const device of devices) {
            const deviceDiv = document.createElement('div');
            deviceDiv.className = 'device-container';
            
            // Create device header
            const deviceHeader = document.createElement('div');
            deviceHeader.className = 'device-header';
            deviceHeader.textContent = device.source || 'Unknown device';
            deviceDiv.appendChild(deviceHeader);
            
            // Create parameters container
            const parametersDiv = document.createElement('div');
            parametersDiv.className = 'parameters-list';
            
            // Fetch and display parameters for this device
            try {
                const response = await fetch(`/api/device-parameters?source=${device.source}`);
                const parameters = await response.json();
                
                parameters.forEach(param => {
                    const paramDiv = document.createElement('div');
                    paramDiv.className = 'parameter-item';
                    paramDiv.textContent = param;
                    paramDiv.onclick = () => displayParameterGraph(device.source, param);
                    parametersDiv.appendChild(paramDiv);
                });
            } catch (error) {
                console.error(`Error fetching parameters for ${device.source}:`, error);
            }
            
            deviceDiv.appendChild(parametersDiv);
            deviceList.appendChild(deviceDiv);
        }
    } catch (error) {
        console.error('Error displaying devices:', error);
        alert('Failed to load devices. Please try again later.');
    }
}

function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

async function displayParameterGraph(source, parameter) {
    try {
        const endTime = new Date();
        const startTime = new Date();
        startTime.setMonth(startTime.getMonth() - 1);
        
        const response = await fetch(
            `/api/device-details?` + new URLSearchParams({
                source: source,
                parameter: parameter,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            })
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const deviceInfo = document.getElementById('device-info');
        deviceInfo.innerHTML = `<h2>${source} - ${parameter}</h2>`;
        
        drawZoomableGraph(data, parameter, source);
    } catch (error) {
        console.error('Error displaying parameter graph:', error);
        alert(`Error loading graph: ${error.message}`);
    }
}

// Move these variables to the global scope
let currentStartTime, currentEndTime;

// Move the fetch function outside drawZoomableGraph
async function fetchNewDataForRange(start, end, source, parameter, chart) {
    if (window.fetchTimeout) {
        clearTimeout(window.fetchTimeout);
    }

    window.fetchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(
                `/api/device-details?` + new URLSearchParams({
                    source: source,
                    parameter: parameter,
                    startTime: start.toISOString(),
                    endTime: end.toISOString()
                })
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Update chart with new data
            chart.data.labels = data.map(item => 
                new Date(item.timestamp || item.SystemProperties['iothub-enqueuedtime'])
            );
            
            const newData = data.map(item => {
                const value = item.Body[parameter];
                return isNaN(parseFloat(value)) ? null : parseFloat(value);
            });
            
            chart.data.datasets[0].data = newData;
            
            // Automatically adjust Y axis
            const validValues = newData.filter(v => v !== null);
            if (validValues.length > 0) {
                const min = Math.min(...validValues);
                const max = Math.max(...validValues);
                const padding = (max - min) * 0.1; // Add 10% padding
                
                chart.options.scales.y.min = min - padding;
                chart.options.scales.y.max = max + padding;
            }
            
            chart.update('none'); // Update without animation
            
            // Update current time range
            currentStartTime = start;
            currentEndTime = end;
        } catch (error) {
            console.error('Error fetching new data:', error);
        }
    }, 500);
}

function drawZoomableGraph(data, parameter, source) {
    const graphContainer = document.getElementById('graph');
    graphContainer.innerHTML = '';

    // Simplified controls with just zoom and move buttons
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'graph-controls';
    graphContainer.appendChild(controlsDiv);

    controlsDiv.innerHTML = `
        <div class="graph-buttons">
            <button id="moveLeft">←</button>
            <button id="zoomOut">−</button>
            <button id="zoomIn">+</button>
            <button id="moveRight">→</button>
        </div>
    `;

    const canvas = document.createElement('canvas');
    graphContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    
    // Process the data for the chart
    const chartData = {
        labels: data.map(item => new Date(item.timestamp || item.SystemProperties['iothub-enqueuedtime'])),
        datasets: [{
            label: parameter,
            data: data.map(item => {
                const value = item.Body[parameter];
                return isNaN(parseFloat(value)) ? null : parseFloat(value);
            }),
            borderWidth: 1,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: false,
            pointRadius: 2
        }]
    };

    // Initialize the time range
    currentStartTime = new Date(Math.min(...chartData.labels));
    currentEndTime = new Date(Math.max(...chartData.labels));
    
    // Add function to update view without using zoom plugin
    async function updateViewRange(newStart, newEnd) {
        // Update the view
        chart.options.scales.x.min = newStart;
        chart.options.scales.x.max = newEnd;
        chart.update('none');
        
        // Fetch and update data
        await fetchNewDataForRange(newStart, newEnd, source, parameter, chart);
        chart.update('none');
    }

    // Update button handlers to use direct scale manipulation
    document.getElementById('zoomIn').addEventListener('click', () => {
        const currentMin = chart.options.scales.x.min || currentStartTime;
        const currentMax = chart.options.scales.x.max || currentEndTime;
        const range = currentMax - currentMin;
        const newRange = range * 0.7;
        const center = new Date((currentMin.getTime() + currentMax.getTime()) / 2);
        const newStart = new Date(center.getTime() - newRange / 2);
        const newEnd = new Date(center.getTime() + newRange / 2);
        updateViewRange(newStart, newEnd);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        const currentMin = chart.options.scales.x.min || currentStartTime;
        const currentMax = chart.options.scales.x.max || currentEndTime;
        const range = currentMax - currentMin;
        const newRange = range * 1.3;
        const center = new Date((currentMin.getTime() + currentMax.getTime()) / 2);
        const newStart = new Date(center.getTime() - newRange / 2);
        const newEnd = new Date(center.getTime() + newRange / 2);
        updateViewRange(newStart, newEnd);
    });

    document.getElementById('moveLeft').addEventListener('click', () => {
        const currentMin = chart.options.scales.x.min || currentStartTime;
        const currentMax = chart.options.scales.x.max || currentEndTime;
        const range = currentMax - currentMin;
        const moveAmount = range * 0.3;
        const newStart = new Date(currentMin.getTime() - moveAmount);
        const newEnd = new Date(currentMax.getTime() - moveAmount);
        updateViewRange(newStart, newEnd);
    });

    document.getElementById('moveRight').addEventListener('click', () => {
        const currentMin = chart.options.scales.x.min || currentStartTime;
        const currentMax = chart.options.scales.x.max || currentEndTime;
        const range = currentMax - currentMin;
        const moveAmount = range * 0.3;
        const newStart = new Date(currentMin.getTime() + moveAmount);
        const newEnd = new Date(currentMax.getTime() + moveAmount);
        updateViewRange(newStart, newEnd);
    });

    // Update the zoom plugin configuration
    const chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            mode: 'x'
                        },
                        pinch: {
                            enabled: true,
                            mode: 'x'
                        },
                        mode: 'x',
                        onZoomComplete: async function(ctx) {
                            const {min, max} = ctx.chart.scales.x;
                            await updateViewRange(new Date(min), new Date(max));
                        }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 10,
                        onPanComplete: async function(ctx) {
                            const {min, max} = ctx.chart.scales.x;
                            await updateViewRange(new Date(min), new Date(max));
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: {
                            hour: 'MMM D, HH:mm'
                        }
                    },
                    title: {
                        display: false,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: parameter
                    }
                }
            }
        }
    });

    return chart;
}

async function fetchMonthsForSource(source) {
  const response = await fetch(`/api/device-months?source=${source}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch months for source: ${source}`);
  }
  const months = await response.json();
  return months;
}

let selectedParameter = null;
let selectedMonth = null;

async function fetchDeviceDetails(source) {
  try {
    // Fetch months for the source first
    const months = await fetchMonthsForSource(source);

    // Determine which month to select
    let monthToSelect = selectedMonth && months.includes(selectedMonth) ? selectedMonth : months[0];

    if (!monthToSelect) {
      throw new Error(`No months available for source: ${source}`);
    }

    // Fetch details for the source and the determined month
    const response = await fetch(`/api/device-details?source=${source}&month=${monthToSelect}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch device details for source: ${source}`);
    }
    const details = await response.json();
    if (!details || details.length === 0) {
      throw new Error(`No details found for source: ${source} and month: ${monthToSelect}`);
    }
    displayDeviceDetails(details, source, monthToSelect, months);
  } catch (error) {
    console.error(error.message);
    alert(error.message);
  }
}

async function displayDeviceDetails(details, source, monthToSelect, months) {
  if (!details || details.length === 0) {
    console.error(`No details available to display for source: ${source}`);
    return;
  }

  const deviceInfo = document.getElementById('device-info');
  deviceInfo.innerHTML = `<h2>Device: ${source}</h2>`;

  const parameterSelect = document.getElementById('parameter-select');
  parameterSelect.innerHTML = '';

  // Collect all unique parameters
  const allParameters = new Set();
  details.forEach(detail => {
    Object.keys(detail.Body).forEach(key => allParameters.add(key));
  });

  // Populate the parameter dropdown with all unique parameters
  allParameters.forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = key;
    parameterSelect.appendChild(option);
  });

  // Populate the month select element
  const monthSelect = document.getElementById('month-select');
  monthSelect.innerHTML = '';

  months.forEach(month => {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = month;
    monthSelect.appendChild(option);
  });

  // Preselect the determined month or the previously selected month
  monthSelect.value = monthToSelect;

  // Preselect the previously selected parameter if available
  if (selectedParameter && allParameters.has(selectedParameter)) {
    parameterSelect.value = selectedParameter;
  } else {
    selectedParameter = [...allParameters][0];
  }

  parameterSelect.onchange = () => {
    selectedParameter = parameterSelect.value;
    drawGraph(details, parameterSelect.value);
  };
  monthSelect.onchange = () => {
    selectedMonth = monthSelect.value;
    fetchAndDisplayDataForMonth(source, monthSelect.value, parameterSelect.value);
  };

  fetchAndDisplayDataForMonth(source, monthToSelect, parameterSelect.value);
}

function fetchAndDisplayDataForMonth(source, month, parameter) {
  fetch(`/api/device-details?source=${source}&month=${month}`)
    .then(response => response.json())
    .then(details => {
      if (!details || details.length === 0) {
        throw new Error(`No details found for source: ${source} and month: ${month}`);
      }
      drawGraph(details, parameter);
    })
    .catch(error => {
      console.error(error.message);
      alert(error.message);
    });
}

function drawGraph(data, parameter) {
    // Clear and prepare the graph container
    const graphContainer = document.getElementById('graph');
    graphContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    graphContainer.appendChild(canvas);

    // Validate data
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error('Invalid or empty data received');
        graphContainer.innerHTML = '<div class="error-message">No data available to display</div>';
        return;
    }

    // Process the data
    const chartData = data.map(item => ({
        x: new Date(item.timestamp),
        y: Number(item.Body[parameter]) || 0
    })).filter(point => !isNaN(point.y)); // Filter out invalid values

    // Create chart configuration by extending the default config
    const chartConfig = {
        ...CHART_DEFAULT_CONFIG,
        data: {
            datasets: [{
                label: parameter,
                data: chartData,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: false
            }]
        },
        options: {
            ...CHART_DEFAULT_CONFIG.options,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM D'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: parameter
                    },
                    beginAtZero: false
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${parameter}: ${context.parsed.y}`
                    }
                }
            }
        }
    };

    // Create the chart
    try {
        new Chart(canvas.getContext('2d'), chartConfig);
    } catch (error) {
        console.error('Error creating chart:', error);
        graphContainer.innerHTML = '<div class="error-message">Failed to create chart</div>';
    }
}
