/** @jsx React.DOM */
var DataCalculator = React.createClass({
    getInitialState: function() {
        return {
            usages: [], 
            plans: []
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
        $(this.refs.dataTable.getDOMNode()).hide();

        // Set the timeout so that react has a chance to build the dom (especially the first time)
        // Before we attempt to slide the result in
        setTimeout(function(){
            $(_this.refs.dataTable.getDOMNode()).slideDown();
            var tableDiv = $(_this.refs.dataTable.getDOMNode())
            $("body").animate({scrollTop: tableDiv.position().top});
        },10);
    },
    componentDidMount: function() {
        this.loadPlansFromServer();
    },
    render: function () {
        return (
            <div className="commentCalculator">
                <DataEntryForm onDataEntered={this.handleDataEntered} />
                <DataTable plans={this.state.plans} usages={this.state.usages} ref="dataTable" />
            </div>
        );
    }
});


var DataTable = React.createClass({
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
                
                return <TableRow elements={usageCost} />
            });
        
            minSum = sums.reduce(function(previous,current){
                if (previous < current) {
                    return previous;
                }
                return current;    
            });
                        
            sums = sums.map(function(sum) {
                var sumValue = {value: "$" + (Math.round(sum / usageCosts.length * 100) / 100)};
                
                if (sum === minSum) {
                    sumValue["lowest"] = true;
                }
                return sumValue;
            });
            
            sums.splice(0,0,{value: "Average Cost"});
            
            return (
                <div className={"row"}>
                    <div className={"col-xs-10 col-xs-offset-1"}>
                        <table className={"table"}>
                            <thead>
                                <TableRow head={true} elements={carriers} />
                            </thead>
                            <tbody>
                                {usageCosts}
                                <TableRow elements={sums} />
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
        else {
            return (
                  <div />
            );
        }
    }
});


var TableRow = React.createClass({
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
                      return <th style={styles} className={classes}><a style={styles} href={element.url} target={"_blank"}>{element.value}</a></th>
                } else {
                      return <th style={styles} className={classes}>{element.value}</th>
                }
            }
            else {
                return <td style={styles} className={classes}>{element.value}</td>;
            }
        });
        
        return (
            <tr>{columns}</tr>
        );
    }
});


var DataEntryForm = React.createClass({
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
        
        var usages = dataUsage.split(/\n/);
        usages = usages.map(function(usage) {
            usage = parseFloat(usage.trim());
            if (_this.state.usageUnit === "kb") {
                usage = usage / 1024;
            }
            return usage;
        });
        
        // Callback whoever is interested in our usage
        if (this.props.onDataEntered) {
            this.props.onDataEntered(usages);
        }
        return;
    },
    unitChanged: function (value) {
        this.state.usageUnit = value;
        this.setState(this.state);
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
            <form data-role={"form"} onSubmit={this.handleSubmit}>
                <div className={"row"}>
                    <div className={"form-group"}>
                        <div className={"col-xs-4 col-xs-offset-2"}>
                            <textarea name="dataUsage" className={"form-control"} ref="dataUsage" placeholder="Enter your data usage, with each month on a separate line" rows="5" />
                        </div>
                    </div>

                    <div className={"form-group"}>
                        <div className={"col-xs-4"}>
                            <div className={"row"}>
                                <label for="usageUnit" className={"control-label"}>Units</label>
                                <RadioSet name="usageUnit" setName={"usageUnit"} options={dataUsageTypes} default={this.state.usageUnit} onChange={this.unitChanged} />
                            </div>
                            
                            <div className={"row"}>
                                <button type="submit" className={"btn btn-default"} value="Calculate">Calculate</button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        );
    }
});


var RadioSet = React.createClass({
    handleChange: function (event) {
        if (this.props.onChange) {
            this.props.onChange(event.target.value);
        }
    },
    render: function () {
        var _this = this;
        return (
            <div class="btn-group">
                {this.props.options.map(function(option) {
                    var classes = "btn btn-default"
                    if (option.value === _this.props.default) {
                        classes += " active";
                    }
                    
                    return <button type={"button"} className={classes} key={option.value} onClick={_this.handleChange} value={option.value}>{option.label}</button>
                })}
            </div>
        );
    }
});

React.renderComponent(        
    <DataCalculator plansUrl="plans.json" />,
    document.getElementById('react-content')
);