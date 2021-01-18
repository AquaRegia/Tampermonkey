// ==UserScript==
// @name         Stadia Game Statistics
// @version      2.0
// @description  Shows information about time played
// @author       AquaRegia
// @match        https://stadia.google.com/profile/*/gameactivities/all
// @require      https://cdn.jsdelivr.net/npm/chart.js@2.8.0/dist/Chart.min.js
// @grant        none
// ==/UserScript==

var dataCollection = [];

var barCanvas = document.createElement("canvas");
barCanvas.id = "barChart";

var pieCanvas = document.createElement("canvas");
pieCanvas.id = "pieChart";

var statsHeader = document.createElement("div");
statsHeader.className = "HZ5mJ";
statsHeader.innerHTML = "Statistics";

var dropdownFilter = document.createElement("select");
dropdownFilter.id = "gameLimit";
dropdownFilter.name = "gameLimit";
dropdownFilter.addEventListener("change", refresh);

var options = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
for(var i = 0; i < options.length; i++)
{
    var op = document.createElement("option");
    op.value = options[i];
    op.text = options[i] == 0 ? "No limit" : options[i];
    dropdownFilter.appendChild(op);
}

var consolidateButton = document.createElement("input");
consolidateButton.type = "checkbox";
consolidateButton.id = "consolidateGames";
consolidateButton.name = "consolidateGames";
consolidateButton.addEventListener("change", refresh);

var consolidateLabel = document.createElement("label");
consolidateLabel.htmlFor = "consolidateGames";
consolidateLabel.innerHTML = "Consolidate hidden";

var gamesHeader = document.querySelector(".HZ5mJ");
gamesHeader.parentNode.style.display = "block";
gamesHeader.parentNode.insertBefore(statsHeader, gamesHeader);
gamesHeader.parentNode.insertBefore(dropdownFilter, gamesHeader);
gamesHeader.parentNode.insertBefore(document.createTextNode(" Number of games to show"), gamesHeader);
gamesHeader.parentNode.insertBefore(document.createElement("br"), gamesHeader);
gamesHeader.parentNode.insertBefore(consolidateButton, gamesHeader);
gamesHeader.parentNode.insertBefore(consolidateLabel, gamesHeader);
gamesHeader.parentNode.insertBefore(barCanvas, gamesHeader);
gamesHeader.parentNode.insertBefore(pieCanvas, gamesHeader);

Chart.defaults.global.defaultFontColor = "white";

var barChart;
var pieChart;
var totalPlayTime;

createCharts();

function refresh()
{
    dataCollection.sort(function(a, b)
    {
        return b[1] - a[1];
    });

    var limit = document.querySelector("#gameLimit").value;
    var consolidate = document.querySelector("#consolidateGames").checked;

    if(limit > 0)
    {
        var workingDataCollection = dataCollection.slice(0, limit);

        if(consolidate && dataCollection > limit)
        {
            var toConsolidate = dataCollection.slice(limit, Infinity);
            workingDataCollection.push([toConsolidate.length + " other game" + (toConsolidate.length > 1 ? "s" : ""), toConsolidate.reduce((acc, game) => acc + game[1], 0)]);
        }
    }
    else
    {
        workingDataCollection = dataCollection;
    }

    totalPlayTime = workingDataCollection.reduce((acc, game) => acc + game[1], 0);
    var randomColors = workingDataCollection.map(game => getRandomColor());

    barChart.data = {
        labels: workingDataCollection.map(game => game[0]),
        datasets:
        [{
            label: "Total time played: " + formatLongTime(totalPlayTime),
            data: workingDataCollection.map(game => game[1]),
            backgroundColor: "#FC4A1F"
        }]
    };

    pieChart.data = {
        labels: workingDataCollection.map(game => game[0]),
            datasets:
            [{
                data: workingDataCollection.map(game => game[1]),
                backgroundColor: randomColors
            }]
    };

    barChart.update();
    pieChart.update();
}

function createCharts()
{
    var barCtx = document.getElementById("barChart").getContext("2d");
    barChart = new Chart(barCtx,
    {
        type: 'bar',
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
                    }
                }],
                xAxes:
                [{
                    gridLines:
                    {
                        display: true,
                        color: "#555",
                        lineWidth: 1
                    }
                }]
            }
        }
    });


    var pieCtx = document.getElementById("pieChart").getContext("2d");
    pieChart = new Chart(pieCtx,
    {
        type: "pie",
        options:
        {
            tooltips:
            {
                callbacks:
                {
                    label: function(tooltipItem, data)
                    {
                        return data.labels[tooltipItem.index] + ": " + ((data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index] / getTotalPlayTime())*100).toFixed(2) + "%";
                    }
                }
            }
        }
    });
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

    return (days < 10 ? "0" : "") + days + " days, " + (hours < 10 ? "0" : "") + hours + " hours, " + (minutes < 10 ? "0" : "") + minutes + " minutes and " + (seconds < 10 ? "0" : "") + seconds + " seconds";
}

function formatYTime(seconds)
{
    return parseInt(seconds/3600) + " hours";
}

function getRandomColor()
{
    var r = Math.floor(Math.random() * 255);
    var g = Math.floor(Math.random() * 255);
    var b = Math.floor(Math.random() * 255);
    return "rgb(" + r + "," + g + "," + b + ")";
}

function getTotalPlayTime()
{
    return totalPlayTime;
}

(function(open)
{
    XMLHttpRequest.prototype.open = function()
    {
        var result = open.apply(this, arguments);

        if(arguments[1].includes("batchexecute?rpcids=QXxVCd&"))
        {
            this.addEventListener("readystatechange", function(e)
            {
                if(this.readyState == 4)
                {
                    try
                    {
                        if(this.responseText.startsWith(")]}'"))
                        {
                            var lines = this.responseText.split(/[0-9]+\n/g);

                            var name;
                            var time;

                            for(let i = 1; i < lines.length; i++)
                            {
                                var json = JSON.parse(lines[i]);

                                if(json[0][0] == "wrb.fr")
                                {
                                    var data = JSON.parse(json[0][2]);

                                    dataCollection.push([data[0][1], data[1][0]]);
                                    refresh();
                                }
                            }
                        }
                    }
                    catch(e)
                    {
                        statsHeader.innerHTML = "Statistics (INCOMPLETE!)";
                        console.log(e);
                    }
                }
            });
        }

        return result;
    };
})(XMLHttpRequest.prototype.open);
