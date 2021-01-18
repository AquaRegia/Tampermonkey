// ==UserScript==
// @name         Netflix Statistics
// @namespace    
// @version      0.1
// @description  
// @author       AquaRegia
// @match        https://www.netflix.com/settings/viewed*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/chart.js@2.8.0/dist/Chart.min.js
// ==/UserScript==

var viewedItems = window.netflix.reactContext.models.vaModel.data.viewedItems;

(function(open)
{
    XMLHttpRequest.prototype.open = function()
    {
        var result = open.apply(this, arguments);

        if(arguments[1].includes("viewingactivity?"))
        {
            this.addEventListener("readystatechange", function(e)
            {
                if(this.readyState == 4)
                {
                    viewedItems = viewedItems.concat(this.response.viewedItems);
                    updateDates();
                }
            });
        }

        return result;
    };
})(XMLHttpRequest.prototype.open);

function getData(from, to)
{
    from = new Date(from);
    to = new Date(to);
    to = to.setDate(to.getDate() + 1);

    var result = viewedItems.filter(e => new Date(e.date) >= from && new Date(e.date) < to);

    console.log(result);

    result = result.reduce(function(acc, element)
    {
        var [key, date] = Object.entries(element)[8];
        (acc[date] || (acc[date] = [])).push(element);
        return acc;
    }, {});

    var fillDate = from;

    while(fillDate < to)
    {
        let dateStr = fillDate.toISOString().split("T")[0];
        result[dateStr] = result[dateStr] || [];

        fillDate = new Date(fillDate.setDate(fillDate.getDate() + 1));
    }

    return Object.entries(result);
}

var barCanvas = document.createElement("canvas");
barCanvas.id = "barChart";
barCanvas.style.backgroundColor = "black";
barCanvas.style.marginBottom = "1em";

var updateGraphButton = document.createElement("button");
updateGraphButton.className = "btn btn-blue btn-small";
updateGraphButton.innerHTML = "Update Graph";
updateGraphButton.style.marginLeft = "50px";
updateGraphButton.addEventListener("click", updateChart);

var dateFrom = document.createElement("input");
dateFrom.type = "date";
dateFrom.id = "dateFrom";
dateFrom.name = "dateFrom";

var fromLabel = document.createElement("label");
fromLabel.htmlFor = "dateFrom";
fromLabel.innerHTML = "From:&nbsp;";
fromLabel.style.display = "inline-block";
fromLabel.style.width = "50px";
fromLabel.style.textAlign = "right";

var dateTo = document.createElement("input");
dateTo.type = "date";
dateTo.id = "dateTo";

var toLabel = document.createElement("label");
toLabel.htmlFor = "dateTo";
toLabel.innerHTML = "To:&nbsp;";
toLabel.style.display = "inline-block";
toLabel.style.width = "50px";
toLabel.style.textAlign = "right";

document.querySelector(".profile-hub-header").before(barCanvas);
document.querySelector(".profile-hub-header").after(document.querySelector(".viewing-activity-footer"));

document.querySelector(".viewing-activity-footer").before(updateGraphButton);

updateGraphButton.before(dateFrom);
dateFrom.after(dateTo);
dateFrom.after(document.createElement("br"));

dateFrom.before(fromLabel);
dateTo.before(toLabel);
dateTo.after(document.createElement("br"));

var barChart;

function updateDates()
{
    var from = document.querySelector("#dateFrom");
    var to = document.querySelector("#dateTo");

    if(!to.value)
    {
        to.value = viewedItems[0].dateStr;
    }

    from.value = viewedItems[viewedItems.length-1].dateStr;
    from.min = to.min = viewedItems[viewedItems.length-1].dateStr;

    updateChart();
}

function updateChart()
{
    var data = getData(document.querySelector("#dateFrom").value, document.querySelector("#dateTo").value).sort((a, b) => a[0] > b[0] ? 1 : -1);

    barChart.data = {
        labels: data.map(e => e[0]),
        datasets:
        [{
            label: "Series total time: " + formatLongTime(data.map(e => e[1]).map(e => e.reduce((a, b) => b.series ? a + b.duration : a, 0)).reduce((a, b) => a + b, 0)),
            data: data.map(e => e[1]).map(e => e.reduce((a, b) => b.series ? a + b.duration : a, 0)),
            backgroundColor: "rgb(229, 9, 20)"
        },
        {
            label: "Movies total time: " + formatLongTime(data.map(e => e[1]).map(e => e.reduce((a, b) => b.series ? a : a + b.duration, 0)).reduce((a, b) => a + b, 0)),
            data: data.map(e => e[1]).map(e => e.reduce((a, b) => b.series ? a : a + b.duration, 0)),
            backgroundColor: "#fcd307"
        }]
    };

    barChart.update();
}

function createChart()
{
    Chart.defaults.global.defaultFontColor = "white";

    barChart = new Chart(document.querySelector("#barChart").getContext("2d"),
    {
        type: "bar",
        options:
        {
            layout:
            {
                padding:
                {
                    left: 60
                }
            },
            tooltips:
            {
                callbacks:
                {
                    label: function(a, b)
                    {
                        return formatTime(a.yLabel);
                    }
                }
            },
            scales:
            {
                yAxes:
                [{
                    gridLines:
                    {
                        display: true,
                        color: "#555",
                        lineWidth: 1
                    },
                    ticks:
                    {
                        beginAtZero: true,
                        callback: function(value, index, values)
                        {
                            return formatYTime(value);
                        }
                    },
                    stacked: true
                }],
                xAxes:
                [{
                    gridLines:
                    {
                        display: true,
                        color: "#555",
                        lineWidth: 1
                    },
                    stacked: true
                }]
            }
        }
    });

    updateDates();
}

function formatTime(seconds)
{
    var hours = parseInt(seconds/3600);
    seconds -= hours*3600;

    var minutes = parseInt(seconds/60);
    seconds -= minutes*60;

    return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function formatLongTime(seconds)
{
    var days = parseInt(seconds/86400);
    seconds -= days*86400;

    var hours = parseInt(seconds/3600);
    seconds -= hours*3600;

    var minutes = parseInt(seconds/60);
    seconds -= minutes*60;

    return (days < 10 ? "0" : "") + days + " days, " + (hours < 10 ? "0" : "") + hours + " hours and " + (minutes < 10 ? "0" : "") + minutes + " minutes";
}

function formatYTime(seconds)
{
    return parseFloat(seconds/3600).toFixed(1) + " hours";
}

createChart();
updateChart();
