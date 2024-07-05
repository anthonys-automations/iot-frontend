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

async function fetchDeviceDetails(source) {
  const response = await fetch(`/api/device-details?source=${source}`);
  const details = await response.json();
  displayDeviceDetails(details);
}

function displayDeviceDetails(details) {
  const deviceInfo = document.getElementById('device-info');
  deviceInfo.innerHTML = `<h2>Device: ${details[0].Properties.source}</h2>`;
  
  const parameterSelect = document.getElementById('parameter-select');
  parameterSelect.innerHTML = '';

  const parameters = Object.keys(details[0].Body);
  parameters.forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      parameterSelect.appendChild(option);
  });

  parameterSelect.onchange = () => drawGraph(details, parameterSelect.value);
  drawGraph(details, parameters[0]);
}

function drawGraph(data, parameter) {
  const graphContainer = document.getElementById('graph');
  graphContainer.innerHTML = ''; // Clear previous graph

  const canvas = document.createElement('canvas');
  graphContainer.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const values = data.map(item => item.Body[parameter]);
  const labels = data.map(item => new Date(item.SystemProperties["iothub-enqueuedtime"]).toISOString());

  // console.log('Data:', data); // Log the filtered data
  // console.log('Labels:', labels); // Log the labels
  // console.log('Values:', values); // Log the values

  new Chart(ctx, {
      type: 'line',
      data: {
          labels: labels,
          datasets: [{
              label: parameter,
              data: values,
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
              spanGaps: true,
              tension: 0.4, // Add tension for smooth line
              fill: false
          }]
      },
      options: {
          scales: {
              x: {
                  type: 'time',
                  time: {
                    unit: 'day'
                  }
              },
              y: {
                  beginAtZero: true
              }
          }
      }
  });
}
