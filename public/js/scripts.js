
document.addEventListener("DOMContentLoaded", () => {
  fetchDevices();
});

async function fetchDevices() {
  const response = await fetch('/api/devices');
  const devices = await response.json();
  displayDevices(devices);
}

function displayDevices(devices) {
  const deviceList = document.getElementById('device-list');
  deviceList.innerHTML = '';
  devices.forEach(device => {
      const div = document.createElement('div');
      div.className = 'device-item';
      div.textContent = device.source;
      div.onclick = () => fetchDeviceDetails(device.source);
      deviceList.appendChild(div);
  });
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

    // Auto-select the last available month
    const lastAvailableMonth = months[0]; // Assuming months are in descending order

    if (!lastAvailableMonth) {
      throw new Error(`No months available for source: ${source}`);
    }

    // Fetch details for the source and the last available month
    const response = await fetch(`/api/device-details?source=${source}&month=${lastAvailableMonth}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch device details for source: ${source}`);
    }
    const details = await response.json();
    if (!details || details.length === 0) {
      throw new Error(`No details found for source: ${source} and month: ${lastAvailableMonth}`);
    }
    displayDeviceDetails(details, source, lastAvailableMonth, months);
  } catch (error) {
    console.error(error.message);
    alert(error.message);
  }
}

async function displayDeviceDetails(details, source, selectedMonth, months) {
  if (!details || details.length === 0) {
    console.error(`No details available to display for source: ${source}`);
    return;
  }

  const deviceInfo = document.getElementById('device-info');
  deviceInfo.innerHTML = `<h2>Device: ${details[0].Properties.source}</h2>`;

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

  // Preselect the last available month or the previously selected month
  monthSelect.value = selectedMonth;

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

  fetchAndDisplayDataForMonth(source, selectedMonth, parameterSelect.value);
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
  const graphContainer = document.getElementById('graph');
  graphContainer.innerHTML = ''; // Clear previous graph

  const canvas = document.createElement('canvas');
  graphContainer.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  
  // Map the data to labels and values
  const labels = data.map(item => new Date(item.SystemProperties["iothub-enqueuedtime"]));
  const values = data.map(item => Number(item.Body[parameter]));

  // Debug: Log the labels and values to ensure they are correct
  console.log('Labels:', labels);
  console.log('Values:', values);

  // Create the chart
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: parameter,
        data: values,
        borderWidth: 1,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: false
      }]
    },
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day'
          },
          title: {
            display: true,
            text: 'Timestamp'
          },
          ticks: {
            // autoSkip: false,
            source: 'data'
          }
        },
        y: {
          title: {
            display: true,
            text: parameter
          }
        }
      },
      elements: {
        line: {
          tension: 0.4 // Smooth the line
        }
      }
    }
  });
}
