// ESC Telemetry Dashboard JavaScript
const socket = io();
let isPaused = false;
let selectedDevice = 'all';
let deviceSet = new Set();

// Chart configuration
const maxDataPoints = 50;
const chartData = {
    rpm: { labels: [], data: [] },
    voltage: { labels: [], data: [] },
    current: { labels: [], data: [] },
    temp: { labels: [], data: [] },
    becTemp: { labels: [], data: [] },
    throttle: { labels: [], data: [] },
    pwm: { labels: [], data: [] }
};

// Chart.js default configuration
Chart.defaults.color = '#8b92b2';
Chart.defaults.borderColor = '#252b47';
Chart.defaults.font.family = 'Segoe UI, sans-serif';

// Initialize charts
const rpmChart = new Chart(document.getElementById('rpm-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'RPM',
            data: [],
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0
        }]
    },
    options: getChartOptions('RPM')
});

const powerChart = new Chart(document.getElementById('power-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Voltage (V)',
                data: [],
                borderColor: '#00ff88',
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y',
                pointRadius: 0
            },
            {
                label: 'Current (A)',
                data: [],
                borderColor: '#ffa500',
                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y1',
                pointRadius: 0
            }
        ]
    },
    options: getDualAxisChartOptions('Voltage (V)', 'Current (A)')
});

const tempChart = new Chart(document.getElementById('temp-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'ESC Temp (°C)',
                data: [],
                borderColor: '#ff3366',
                backgroundColor: 'rgba(255, 51, 102, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0
            },
            {
                label: 'BEC Temp (°C)',
                data: [],
                borderColor: '#7b2ff7',
                backgroundColor: 'rgba(123, 47, 247, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0
            }
        ]
    },
    options: getChartOptions('Temperature (°C)')
});

const throttleChart = new Chart(document.getElementById('throttle-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Throttle (%)',
                data: [],
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y',
                pointRadius: 0
            },
            {
                label: 'PWM',
                data: [],
                borderColor: '#7b2ff7',
                backgroundColor: 'rgba(123, 47, 247, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                yAxisID: 'y1',
                pointRadius: 0
            }
        ]
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
    
    // Add device to set and update selector
    if (!deviceSet.has(data.device)) {
        deviceSet.add(data.device);
        updateDeviceSelector();
    }
    
    // Filter by selected device
    if (selectedDevice !== 'all' && data.device !== parseInt(selectedDevice)) {
        return;
    }
    
    // Update stats cards
    updateStats(data);
    
    // Update charts
    updateCharts(data);
    
    // Update data table
    updateTable(data);
});

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
    // RPM
    document.getElementById('rpm-value').textContent = data.rpm || 0;
    
    // Voltage (convert from mV to V)
    const voltage = (data.voltage_mV / 1000).toFixed(2);
    document.getElementById('voltage-value').textContent = voltage;
    
    // Current (convert from mA to A)
    const current = (data.current_mA / 1000).toFixed(2);
    document.getElementById('current-value').textContent = current;
    
    // Temperature (convert from tenths to degrees)
    const temp = (data.tempC_x10 / 10).toFixed(1);
    document.getElementById('temp-value').textContent = temp;
    
    // Throttle (convert from tenths to percent)
    const throttle = (data.throttle_x10 / 10).toFixed(1);
    document.getElementById('throttle-value').textContent = throttle;
    
    // Consumption
    document.getElementById('consumption-value').textContent = data.consumption_mAh || 0;
    
    // BEC Voltage (convert from mV to V)
    const becVoltage = (data.bec_voltage_mV / 1000).toFixed(2);
    document.getElementById('bec-voltage-value').textContent = becVoltage;
    
    // BEC Temperature (convert from tenths to degrees)
    const becTemp = (data.bec_tempC_x10 / 10).toFixed(1);
    document.getElementById('bec-temp-value').textContent = becTemp;
}

function updateCharts(data) {
    const timestamp = formatTime(data.ts_ms);
    
    // Add data point
    addChartData(timestamp, {
        rpm: data.rpm || 0,
        voltage: data.voltage_mV / 1000,
        current: data.current_mA / 1000,
        temp: data.tempC_x10 / 10,
        becTemp: data.bec_tempC_x10 / 10,
        throttle: data.throttle_x10 / 10,
        pwm: data.pwm_x10 / 10
    });
    
    // Update all charts
    updateChart(rpmChart, timestamp, chartData.rpm.data);
    updateDualChart(powerChart, timestamp, chartData.voltage.data, chartData.current.data);
    updateDualChart(tempChart, timestamp, chartData.temp.data, chartData.becTemp.data);
    updateDualChart(throttleChart, timestamp, chartData.throttle.data, chartData.pwm.data);
}

function addChartData(label, values) {
    // Add new data
    chartData.rpm.labels.push(label);
    chartData.rpm.data.push(values.rpm);
    chartData.voltage.data.push(values.voltage);
    chartData.current.data.push(values.current);
    chartData.temp.data.push(values.temp);
    chartData.becTemp.data.push(values.becTemp);
    chartData.throttle.data.push(values.throttle);
    chartData.pwm.data.push(values.pwm);
    
    // Remove old data if exceeding max points
    if (chartData.rpm.labels.length > maxDataPoints) {
        chartData.rpm.labels.shift();
        chartData.rpm.data.shift();
        chartData.voltage.data.shift();
        chartData.current.data.shift();
        chartData.temp.data.shift();
        chartData.becTemp.data.shift();
        chartData.throttle.data.shift();
        chartData.pwm.data.shift();
    }
}

function updateChart(chart, label, data) {
    chart.data.labels = chartData.rpm.labels;
    chart.data.datasets[0].data = data;
    chart.update('none');
}

function updateDualChart(chart, label, data1, data2) {
    chart.data.labels = chartData.rpm.labels;
    chart.data.datasets[0].data = data1;
    chart.data.datasets[1].data = data2;
    chart.update('none');
}

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
    // Clear data arrays
    chartData.rpm.labels = [];
    chartData.rpm.data = [];
    chartData.voltage.data = [];
    chartData.current.data = [];
    chartData.temp.data = [];
    chartData.becTemp.data = [];
    chartData.throttle.data = [];
    chartData.pwm.data = [];
    
    // Update all charts
    rpmChart.data.labels = [];
    rpmChart.data.datasets[0].data = [];
    rpmChart.update();
    
    powerChart.data.labels = [];
    powerChart.data.datasets.forEach(ds => ds.data = []);
    powerChart.update();
    
    tempChart.data.labels = [];
    tempChart.data.datasets.forEach(ds => ds.data = []);
    tempChart.update();
    
    throttleChart.data.labels = [];
    throttleChart.data.datasets.forEach(ds => ds.data = []);
    throttleChart.update();
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
