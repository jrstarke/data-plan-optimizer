/** @jsx React.DOM */
var DataCalculator = React.createClass({displayName: 'DataCalculator',
    getInitialState: function() {
        return {
            usages: [], 
            plans: [],
            tableShown: false
        };
    },
    loadPlansFromServer: function() {
        $.ajax({
            url: this.props.plansUrl,
            dataType: 'json',
            success: function(plans) {
                this.state.plans = plans;
                this.setState(this.state);
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },
    handleDataEntered: function(usages) {
        var _this = this;

        this.state.usages = usages;
        this.setState(this.state);

        // Set the timeout so that react has a chance to build the dom (especially the first time)
        // Before we attempt to slide the result in
        setTimeout(function(){
            $(_this.refs.dataTable.getDOMNode()).slideDown();
            var tableDiv = $(_this.refs.dataTable.getDOMNode())
            $("body").animate({scrollTop: tableDiv.position().top});
            _this.state.tableShown = true;
            _this.setState(this.state);
        },10);
    },
    componentDidMount: function() {
        this.loadPlansFromServer();
    },
    render: function () {
        tableStyles = {};
        if (!this.state.tableShown) {
            tableStyles['display'] = "none";
        }
    
        return (
            React.createElement("div", {className: "commentCalculator"}, 
                React.createElement(DataEntryForm, {onDataEntered: this.handleDataEntered}), 
                React.createElement(DataTable, {styles: tableStyles, plans: this.state.plans, usages: this.state.usages, ref: "dataTable"})
            )
        );
    }
});


var DataTable = React.createClass({displayName: 'DataTable',
    render: function () {
        var _this = this;
    
        // Most of this is just building the data so that we can actually render it
        // such as finding the tier that someone would fall into, and calculating
        // the price
        if (this.props.usages && this.props.usages.length > 0 && this.props.plans && this.props.plans.length) {
            var carriers = this.props.plans.map(function(plan) {
                return {
                    value: plan.name, 
                    color: plan.nameColor, 
                    backgroundColor: plan.nameBackgroundColor,
                    url: plan.planUrl
                };
            });
            carriers.splice(0,0,{value:"Usage"});
            
            var sums = [];
            var usageCosts = this.props.usages.map(function(usage) {
                var usageCost = _this.props.plans.map(function(plan, index) {
                    var cost = plan.flexRanges.reduce(function(previousBestPrice, currentPlan) {
                        if (previousBestPrice) {
                            return previousBestPrice;
                        }
                        
                        if (currentPlan.maxData >= usage) {
                            return currentPlan.price;
                        }
                        
                        return null;
                    }, null);
                    
                    if (! cost) {
                        var remaining = usage - plan.overage.includedData;
                        if (remaining % plan.overage.overageUnitSize > 0) {
                            remaining = remaining - (remaining % plan.overage.overageUnitSize) + plan.overage.overageUnitSize;
                        }
                        cost = (remaining / plan.overage.overageUnitSize) * plan.overage.overageUnitPrice + plan.overage.includedPrice;
                    }
                    
                    sums[index] = (sums[index] ? sums[index] : 0) + cost;
                    return {value: "$" + (Math.round(cost * 100) / 100)};
                });
                usageCost.splice(0,0,{value:usage + " MB"});
                
                return React.createElement(TableRow, {elements: usageCost})
            });
        
            minSum = sums.reduce(function(previous,current){
                if (previous < current) {
                    return previous;
                }
                return current;    
            });
            
            var trackData = {};       
            sums = sums.map(function(sum,index) {
                var roundedSum = Math.round(sum / usageCosts.length * 100) / 100
                var sumValue = {value: "$" + roundedSum};
                
                if (sum === minSum) {
                    sumValue["lowest"] = true;
                }
                trackData[this.props.plans[index].name + " Average Cost"] = roundedSum;
                return sumValue;
            }.bind(this));
            
            sums.splice(0,0,{value: "Average Cost"});
            mixpanel.track("Plans Shown",trackData);
            
            return (
                React.createElement("div", {className: "row"}, 
                    React.createElement("div", {className: "col-md-12 table-responsive"}, 
                        React.createElement("table", {className: "table table-bordered table-hover"}, 
                            React.createElement("thead", null, 
                                React.createElement(TableRow, {head: true, elements: carriers})
                            ), 
                            React.createElement("tbody", null, 
                                usageCosts, 
                                React.createElement(TableRow, {elements: sums})
                            )
                        )
                    )
                )
            );
        }
        else {
            return (
                  React.createElement("div", null)
            );
        }
    }
});


var TableRow = React.createClass({displayName: 'TableRow',
    render: function () {
        var _this = this;
        var columns = this.props.elements.map(function(element) {
            var classes = "";
            var styles = {};
            
            if (element.color) {
                styles["color"] = element.color;
            }
            
            if (element.backgroundColor) {
                styles["background-color"] = element.backgroundColor;
            }
            
            if (element.lowest) {
                classes += "success";
            }
        
            if (_this.props.head) {
                if (element.url) {
                      return React.createElement("th", {style: styles, className: classes}, React.createElement("a", {style: styles, href: element.url, target: "_blank"}, element.value))
                } else {
                      return React.createElement("th", {style: styles, className: classes}, element.value)
                }
            }
            else {
                return React.createElement("td", {style: styles, className: classes}, element.value);
            }
        });
        
        return (
            React.createElement("tr", null, columns)
        );
    }
});


var DataEntryForm = React.createClass({displayName: 'DataEntryForm',
    getInitialState: function() {
        return {
            usageUnit: "mb"
        };
    },
    handleSubmit: function(e) {
        var _this = this;
      
        e.preventDefault();
        var dataUsage = this.refs.dataUsage.getDOMNode().value.trim();
        
        if (!dataUsage) {
            return;
        }
        
        var trackData = {}
        var sum = 0;
        var usages = dataUsage.split(/\n/);
        usages = usages.map(function(usage,index) {
            usage = parseFloat(usage.trim());
            if (_this.state.usageUnit === "kb") {
                usage = usage / 1024;
            }
            trackData['usage'+index] = usage;
            sum += usage;
            return usage;
        });
        
        trackData["unit"] = this.state.usageUnit;
        trackData["average"] = sum;
        mixpanel.track("Calculate Plans",trackData);
        
        // Callback whoever is interested in our usage
        if (this.props.onDataEntered) {
            this.props.onDataEntered(usages);
        }
        return;
    },
    unitChanged: function (value) {
        this.state.usageUnit = value;
        this.setState(this.state);
        mixpanel.track("Changed Units",{"unit":value});
    },
    sampleData: function (e) {
        e.preventDefault();
        mixpanel.track("Used Sample Data");
        $.ajax({
            url: "sample.data",
            dataType: 'text',
            success: function(data) {
                this.refs.dataUsage.getDOMNode().value = data;
            }.bind(this),
            error: function(xhr, status, err) {
                console.error("sample.data", status, err.toString());
            }.bind(this)
        });
    },
    render: function() {
        dataUsageTypes = [
            {
                label:'MB',
                value:'mb'
            },
            {
                label: 'KB',
                value: 'kb'
            }
        ];

        dataUsageSetName="usageUnit";

        return (
            React.createElement("form", {'data-role': "form"}, 
                React.createElement("div", {className: "row"}, 
                    React.createElement("div", {className: "col-md-10"}, 
                        React.createElement("div", {className: "form-group"}, 
                            React.createElement("textarea", {name: "dataUsage", className: "form-control", ref: "dataUsage", placeholder: "Enter your data usage, with each month on a separate line", rows: "5"})
                        )
                    ), 

                    React.createElement("div", {className: "col-md-2"}, 
                        React.createElement("div", {className: "form-group"}, 
                            React.createElement("button", {className: "btn btn-default", onClick: this.sampleData}, "Get Sample Data")
                        ), 
                        
                        React.createElement("div", {className: "form-group"}, 
                            React.createElement("label", {for: "usageUnit", className: "control-label"}, "Units"), 
                            React.createElement(RadioSet, {name: "usageUnit", setName: "usageUnit", options: dataUsageTypes, default: this.state.usageUnit, onChange: this.unitChanged})
                        )
                    )
                ), 
                
                React.createElement("div", {className: "row"}, 
                    React.createElement("div", {className: "col-md-2"}, 
                        React.createElement("div", {className: "form-group"}, 
                            React.createElement("button", {className: "btn btn-primary", onClick: this.handleSubmit}, "Calculate")
                        )
                    )
                )
            )
        );
    }
});


var RadioSet = React.createClass({displayName: 'RadioSet',
    handleChange: function (event) {
        if (this.props.onChange) {
            this.props.onChange(event.target.value);
        }
    },
    render: function () {
        var _this = this;
        return (
            React.createElement("div", {class: "btn-group"}, 
                this.props.options.map(function(option) {
                    var classes = "btn btn-default"
                    if (option.value === _this.props.default) {
                        classes += " active";
                    }
                    
                    return React.createElement("button", {type: "button", className: classes, key: option.value, onClick: _this.handleChange, value: option.value}, option.label)
                })
            )
        );
    }
});

React.renderComponent(        
    React.createElement(DataCalculator, {plansUrl: "plans.json"}),
    document.getElementById('react-content')
);