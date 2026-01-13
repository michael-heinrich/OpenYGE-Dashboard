// ESC Telemetry Dashboard JavaScript
const socket = io();
let isPaused = false;
let selectedDevice = 'all';
let deviceSet = new Set();

// Chart configuration
const maxDataPoints = 1200; // 2 minutes @ 10Hz, 1 minute @ 20Hz
const deviceColors = [
    '#00d4ff', '#00ff88', '#ff3366', '#7b2ff7', 
    '#ffa500', '#2ecc71', '#e74c3c', '#3498db'
];

function getDeviceColor(deviceId, alpha = 1, isSecondary = false) {
    const baseColor = deviceColors[deviceId % deviceColors.length];
    if (!isSecondary) return baseColor;
    
    // For secondary metrics like Current or PWM, maybe shift the color slightly
    // or return a predefined secondary color. For now, let's just use the same
    // but we could use a different palette.
    return baseColor;
}

const chartData = {
    labels: [],
    devices: {} // deviceId -> { rpm: [], voltage: [], current: [], temp: [], becTemp: [], throttle: [], pwm: [] }
};

const lastValues = {}; // deviceId -> latest data packet

// Chart.js default configuration
Chart.defaults.color = '#8b92b2';
Chart.defaults.borderColor = '#252b47';
Chart.defaults.font.family = 'Segoe UI, sans-serif';

// Initialize charts
const rpmChart = new Chart(document.getElementById('rpm-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: []
    },
    options: getChartOptions('RPM')
});

const powerChart = new Chart(document.getElementById('power-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: []
    },
    options: getDualAxisChartOptions('Voltage (V)', 'Current (A)')
});

const tempChart = new Chart(document.getElementById('temp-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: []
    },
    options: getChartOptions('Temperature (°C)')
});

const throttleChart = new Chart(document.getElementById('throttle-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: []
    },
    options: getDualAxisChartOptions('Throttle (%)', 'PWM')
});

// Chart options helper
function getChartOptions(yAxisLabel) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 15
                }
            },
            tooltip: {
                backgroundColor: 'rgba(10, 14, 39, 0.9)',
                borderColor: '#00d4ff',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += context.parsed.y.toFixed(2);
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                display: true,
                grid: {
                    color: '#252b47',
                    drawBorder: false
                },
                ticks: {
                    maxTicksLimit: 10
                }
            },
            y: {
                display: true,
                grid: {
                    color: '#252b47',
                    drawBorder: false
                },
                title: {
                    display: true,
                    text: yAxisLabel,
                    color: '#00d4ff'
                }
            }
        },
        animation: {
            duration: 300
        }
    };
}

function getDualAxisChartOptions(yAxisLabel, y1AxisLabel) {
    const options = getChartOptions(yAxisLabel);
    options.scales.y1 = {
        display: true,
        position: 'right',
        grid: {
            drawOnChartArea: false,
        },
        title: {
            display: true,
            text: y1AxisLabel,
            color: '#ffa500'
        }
    };
    return options;
}

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
});

socket.on('telemetry', (data) => {
    if (isPaused) return;
    
    const deviceId = data.device;
    lastValues[deviceId] = data;

    // Add device to set and update selector
    if (!deviceSet.has(deviceId)) {
        deviceSet.add(deviceId);
        initDeviceData(deviceId);
        updateDeviceSelector();
    }
    
    // Update stats cards (always update for the device that just sent data)
    updateStats(data);
    
    // Update data table
    updateTable(data);

    // Update charts (handle filtering and multi-line)
    updateCharts(data);
});

function initDeviceData(deviceId) {
    if (!chartData.devices[deviceId]) {
        chartData.devices[deviceId] = {
            rpm: [], voltage: [], current: [], temp: [],
            becTemp: [], throttle: [], pwm: []
        };
        
        // Fill with nulls to match current labels length
        const currentLen = chartData.labels.length;
        for (let i = 0; i < currentLen; i++) {
            chartData.devices[deviceId].rpm.push(null);
            chartData.devices[deviceId].voltage.push(null);
            chartData.devices[deviceId].current.push(null);
            chartData.devices[deviceId].temp.push(null);
            chartData.devices[deviceId].becTemp.push(null);
            chartData.devices[deviceId].throttle.push(null);
            chartData.devices[deviceId].pwm.push(null);
        }
        
        // Add datasets to charts
        addDeviceDatasetsToCharts(deviceId);
    }
}

function addDeviceDatasetsToCharts(deviceId) {
    const color = getDeviceColor(deviceId);
    
    // RPM Chart
    rpmChart.data.datasets.push({
        label: `ESC ${deviceId} RPM`,
        data: chartData.devices[deviceId].rpm,
        borderColor: color,
        backgroundColor: `${color}1A`, // 10% opacity
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        deviceId: deviceId
    });

    // Power Chart
    powerChart.data.datasets.push({
        label: `ESC ${deviceId} Voltage (V)`,
        data: chartData.devices[deviceId].voltage,
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
        deviceId: deviceId,
        borderDash: []
    });
    powerChart.data.datasets.push({
        label: `ESC ${deviceId} Current (A)`,
        data: chartData.devices[deviceId].current,
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 0,
        deviceId: deviceId,
        borderDash: [5, 5] // Dashed for current to distinguish
    });

    // Temp Chart
    tempChart.data.datasets.push({
        label: `ESC ${deviceId} Temp (°C)`,
        data: chartData.devices[deviceId].temp,
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        deviceId: deviceId
    });
    tempChart.data.datasets.push({
        label: `ESC ${deviceId} BEC Temp (°C)`,
        data: chartData.devices[deviceId].becTemp,
        borderColor: color,
        borderWidth: 1,
        borderDash: [2, 2],
        tension: 0.4,
        pointRadius: 0,
        deviceId: deviceId
    });

    // Throttle Chart
    throttleChart.data.datasets.push({
        label: `ESC ${deviceId} Throttle (%)`,
        data: chartData.devices[deviceId].throttle,
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y',
        pointRadius: 0,
        deviceId: deviceId
    });
    throttleChart.data.datasets.push({
        label: `ESC ${deviceId} PWM`,
        data: chartData.devices[deviceId].pwm,
        borderColor: color,
        borderWidth: 1,
        borderDash: [3, 3],
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 0,
        deviceId: deviceId
    });

    rpmChart.update();
    powerChart.update();
    tempChart.update();
    throttleChart.update();
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-status');
    const text = document.getElementById('connection-text');
    
    if (connected) {
        indicator.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        text.textContent = 'Disconnected';
    }
}

function updateStats(data) {
    const deviceId = data.device;
    
    updateStatValue('rpm', deviceId, data.rpm || 0);
    updateStatValue('voltage', deviceId, (data.voltage_mV / 1000).toFixed(2));
    updateStatValue('current', deviceId, (data.current_mA / 1000).toFixed(2));
    updateStatValue('temp', deviceId, (data.tempC_x10 / 10).toFixed(1));
    updateStatValue('throttle', deviceId, (data.throttle_x10 / 10).toFixed(1));
    updateStatValue('consumption', deviceId, data.consumption_mAh || 0);
    updateStatValue('bec-voltage', deviceId, (data.bec_voltage_mV / 1000).toFixed(2));
    updateStatValue('bec-temp', deviceId, (data.bec_tempC_x10 / 10).toFixed(1));
}

function updateStatValue(metric, deviceId, value) {
    const container = document.getElementById(`${metric}-container`);
    if (!container) return;
    
    let element = document.getElementById(`${metric}-value-${deviceId}`);
    if (!element) {
        // Remove placeholder if it exists
        const placeholder = document.getElementById(`${metric}-value`);
        if (placeholder) {
            placeholder.remove();
        }

        element = document.createElement('div');
        element.id = `${metric}-value-${deviceId}`;
        element.className = 'device-stat-row';
        element.style.borderColor = getDeviceColor(deviceId);
        element.innerHTML = `
            <span class="device-label">#${deviceId}</span>
            <span class="stat-value">${value}</span>
        `;
        container.appendChild(element);
    } else {
        element.querySelector('.stat-value').textContent = value;
    }
}

function updateCharts(data) {
    const timestamp = formatTime(data.ts_ms);
    const deviceId = String(data.device);
    
    // Add data point to all datasets
    addChartData(timestamp, deviceId, data);
    
    // Update chart visibility based on selection
    const filter = (ds) => {
        if (selectedDevice === 'all') return true;
        return String(ds.deviceId) === selectedDevice;
    };

    // Update all charts
    [rpmChart, powerChart, tempChart, throttleChart].forEach(chart => {
        chart.data.labels = chartData.labels;
        chart.data.datasets.forEach(ds => {
            ds.hidden = !filter(ds);
        });
        chart.update('none');
    });
}

function addChartData(label, deviceId, data) {
    chartData.labels.push(label);
    
    // For each device, push either its new data or its last known data
    Object.keys(chartData.devices).forEach(id => {
        const deviceStore = chartData.devices[id];
        
        if (id === deviceId) {
            deviceStore.rpm.push(Number(data.rpm) || 0);
            deviceStore.voltage.push(Number(data.voltage_mV) / 1000);
            deviceStore.current.push(Number(data.current_mA) / 1000);
            deviceStore.temp.push(Number(data.tempC_x10) / 10);
            deviceStore.becTemp.push(Number(data.bec_tempC_x10) / 10);
            deviceStore.throttle.push(Number(data.throttle_x10) / 10);
            deviceStore.pwm.push(Number(data.pwm_x10) / 10);
        } else {
            const last = lastValues[id];
            deviceStore.rpm.push(last ? Number(last.rpm) : null);
            deviceStore.voltage.push(last ? Number(last.voltage_mV) / 1000 : null);
            deviceStore.current.push(last ? Number(last.current_mA) / 1000 : null);
            deviceStore.temp.push(last ? Number(last.tempC_x10) / 10 : null);
            deviceStore.becTemp.push(last ? Number(last.bec_tempC_x10) / 10 : null);
            deviceStore.throttle.push(last ? Number(last.throttle_x10) / 10 : null);
            deviceStore.pwm.push(last ? Number(last.pwm_x10) / 10 : null);
        }
        
        // Trim
        if (deviceStore.rpm.length > maxDataPoints) {
            deviceStore.rpm.shift();
            deviceStore.voltage.shift();
            deviceStore.current.shift();
            deviceStore.temp.shift();
            deviceStore.becTemp.shift();
            deviceStore.throttle.shift();
            deviceStore.pwm.shift();
        }
    });

    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
    }
}

// These are now handled within updateCharts and addChartData
function updateChart(chart, label, data) { }
function updateDualChart(chart, label, data1, data2) { }

function updateTable(data) {
    const tbody = document.getElementById('data-table-body');
    
    // Remove "no data" row if it exists
    const noDataRow = tbody.querySelector('.no-data');
    if (noDataRow) {
        noDataRow.remove();
    }
    
    // Create new row
    const row = document.createElement('tr');
    row.classList.add('new-row');
    
    row.innerHTML = `
        <td>${formatTime(data.ts_ms)}</td>
        <td>${data.device}</td>
        <td>${data.rpm || 0}</td>
        <td>${(data.voltage_mV / 1000).toFixed(2)} V</td>
        <td>${(data.current_mA / 1000).toFixed(2)} A</td>
        <td>${(data.throttle_x10 / 10).toFixed(1)}%</td>
        <td>${(data.tempC_x10 / 10).toFixed(1)}°C</td>
        <td>${data.rx_frames_received || 0}</td>
        <td>${data.rx_frames_dropped || 0}</td>
    `;
    
    // Insert at the beginning
    tbody.insertBefore(row, tbody.firstChild);
    
    // Limit table rows to 100
    while (tbody.children.length > 100) {
        tbody.removeChild(tbody.lastChild);
    }
}

function updateDeviceSelector() {
    const selector = document.getElementById('device-selector');
    const currentSelection = selector.value;
    
    // Clear existing options except "All"
    selector.innerHTML = '<option value="all">All Devices</option>';
    
    // Add device options
    Array.from(deviceSet).sort((a, b) => a - b).forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = `Device ${device}`;
        selector.appendChild(option);
    });
    
    // Restore selection
    selector.value = currentSelection;
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function clearCharts() {
    // Clear labels
    chartData.labels = [];
    
    // Clear data arrays for all devices
    Object.keys(chartData.devices).forEach(deviceId => {
        const deviceStore = chartData.devices[deviceId];
        deviceStore.rpm = [];
        deviceStore.voltage = [];
        deviceStore.current = [];
        deviceStore.temp = [];
        deviceStore.becTemp = [];
        deviceStore.throttle = [];
        deviceStore.pwm = [];
    });
    
    // Update all charts
    [rpmChart, powerChart, tempChart, throttleChart].forEach(chart => {
        chart.data.labels = [];
        chart.update();
    });
}

// Event listeners
document.getElementById('pause-btn').addEventListener('click', (e) => {
    isPaused = !isPaused;
    e.target.textContent = isPaused ? 'Resume' : 'Pause';
    e.target.classList.toggle('btn-primary');
    e.target.classList.toggle('btn-secondary');
});

document.getElementById('clear-btn').addEventListener('click', () => {
    clearCharts();
    
    // Clear table
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = '<tr class="no-data"><td colspan="9">Waiting for telemetry data...</td></tr>';
});

document.getElementById('device-selector').addEventListener('change', (e) => {
    selectedDevice = e.target.value;
    clearCharts();
});

console.log('ESC Telemetry Dashboard initialized');
