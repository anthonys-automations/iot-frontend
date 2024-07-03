const sourceSelect = document.getElementById('sourceSelect');
const keySelect = document.getElementById('keySelect');
const ctx = document.getElementById('chart').getContext('2d');
let chart;

async function fetchTelemetryData() {
    const response = await fetch('/api/telemetry');
    const data = await response.json();
    console.log('Fetched telemetry data:', data); // Log the fetched data
    return data;
}

function updateDropdowns(data) {
    const sources = new Set();
    const keys = new Set();

    data.forEach(item => {
        sources.add(item.properties.source);
        Object.keys(item).forEach(key => {
            if (key !== 'properties' && key !== 'timestamp') {
                keys.add(key);
            }
        });
    });

    sourceSelect.innerHTML = Array.from(sources).map(source => `<option value="${source}">${source}</option>`).join('');
    keySelect.innerHTML = Array.from(keys).map(key => `<option value="${key}">${key}</option>`).join('');

    console.log('Sources:', Array.from(sources)); // Log the sources
    console.log('Keys:', Array.from(keys)); // Log the keys
}

function updateChart(data) {
    const selectedSource = sourceSelect.value;
    const selectedKey = keySelect.value;

    console.log('Selected source:', selectedSource); // Log the selected source
    console.log('Selected key:', selectedKey); // Log the selected key

    const filteredData = data.filter(item => item.properties.source === selectedSource);
    const labels = filteredData.map(item => new Date(item.timestamp).toISOString()); // Convert to ISO format
    const values = filteredData.map(item => item[selectedKey]);

    console.log('Filtered data:', filteredData); // Log the filtered data
    console.log('Labels:', labels); // Log the labels
    console.log('Values:', values); // Log the values

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: selectedKey,
                data: values,
                fill: false,
                borderColor: 'rgba(255, 204, 0, 1)',
                pointBorderColor: 'rgba(255, 204, 0, 1)',
                backgroundColor: 'rgba(255, 204, 0, 0.4)',
                pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
                pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
                spanGaps: true,
                tension: 0.4, // Add tension for smooth line
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

fetchTelemetryData().then(data => {
    updateDropdowns(data);
    updateChart(data);

    sourceSelect.addEventListener('change', () => updateChart(data));
    keySelect.addEventListener('change', () => updateChart(data));
});
