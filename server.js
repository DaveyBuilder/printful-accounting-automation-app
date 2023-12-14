const path = require("path");
const express = require('express');
const fetch = require("node-fetch");
const hbs = require("hbs");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const { exec } = require('child_process');
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    res.render("welcome");
});

require('dotenv').config()
const printfulApiKey = process.env.PRINTFUL_API_KEY;

const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'EL', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

app.get("/getPrintfulOrders", async (req, res) => {
    try {
        const date = new Date();
        const timestamp = date.getTime();

        const reportStartDate = req.query.startDate;
        const reportEndDate = req.query.endDate;
        let unixStartDate = reportStartDate ? Date.parse(reportStartDate) / 1000 : 0;
        let unixEndDate = reportEndDate ? new Date(reportEndDate).setHours(23,59,59,999) / 1000 : Math.floor(Date.now() / 1000);

        let allOrdersArray = [];

        const limit = 100;
        let offset = 0;
        let passedReportStartDate = false;
        let passedTotalOrders = false;
        let jsonList;

        //loop that increases offset by 100 each time until passedReportStartDate is true
        while (!passedReportStartDate && !passedTotalOrders) {
        
            const url = `https://api.printful.com/orders?limit=${limit}&offset=${offset}`;
            
            const headers = {
                'Authorization': `Bearer ${printfulApiKey}`
            };

            const response = await fetch(url, { headers: headers });

            if (response.ok) {

                console.log('Processing...');
                jsonList = await response.json();
                
                jsonList.result.forEach(order => {

                    //check if order is within date range
                    let createdDate = parseInt(order.created);
                    if (createdDate >= unixStartDate && createdDate <= unixEndDate) {
                        
                        //CUSTOM CALCULATIONS
                        let netAmount = parseFloat(order.costs.total) - parseFloat(order.costs.vat) - parseFloat(order.costs.tax);
                        netAmount = netAmount.toFixed(2);
                        //vat calculation
                        let vatCost = parseFloat(order.costs.vat);
                        let totalCost = parseFloat(order.costs.total);
                        let taxCost = parseFloat(order.costs.tax);
                        let vatRate;
                        if (vatCost === 0 && totalCost === 0 && taxCost === 0) {
                        vatRate = 0;
                        } else {
                        vatRate = (vatCost / (totalCost - taxCost - vatCost));
                        vatRate = isNaN(vatRate) ? 0 : vatRate.toFixed(2);
                        }
                        //sku calculation
                        let skus = order.items
                            .filter(item => item.sku !== null && item.sku !== undefined)
                            .map(item => item.sku)
                            .join(' and ');
                        //description calculation
                        let itemDescriptions = order.items.map(item => item.name).join(' and ');
                        //dispatch country calculation
                        let dispatchLocationsSet = new Set(order.shipments.map(shipment => shipment.location));
                        let dispatchCountry;
                        if (dispatchLocationsSet.size === 1) {
                            dispatchCountry = [...dispatchLocationsSet][0];
                        } else {
                            if (euCountries.includes(order.recipient.country_code)) {
                                dispatchCountry = parseFloat(netAmount) > 150 ? "MIXED-2" : "MIXED-1";
                            } else {
                                dispatchCountry = "MIXED-3";
                            }
                        }
                        //convert order.created unix timestamp to date
                        let orderDate = new Date(order.created * 1000);
                        let orderDateString = orderDate.toISOString().split('T')[0];

                        let individualOrderObject = {
                            INVOICE_CREDIT_NOTE_NUMBER: order.id,
                            INVOICE_CREDIT_NOTE_DATE: orderDateString,
                            PAYMENT_DATE: orderDateString,
                            SUPPLIER_NAME: "Printful",
                            SUPPLIER_VAT_NUMBER: null,
                            DEPARTURE_COUNTRY: dispatchCountry,
                            ARRIVAL_COUNTRY: order.recipient.country_code,
                            CUSTOMER_VAT_NUMBER: null,
                            SERVICE_TYPE: null,
                            GOODS_SERVICE: "GOODS",
                            NATURE_OF_TRANSACTION: null,
                            SKU: skus,
                            ITEM_DESCRIPTION: itemDescriptions,
                            GROSS: order.costs.total,
                            NET: netAmount,
                            VAT: order.costs.vat,
                            CURRENCY: order.costs.currency,
                            VAT_RATE_APPLIED: vatRate,
                            SUPPLIER_ESTABLISHED: null,
                            CATEGORY: "OTHER",
                            PURPOSE_OF_GOODS: null
                        };

                        allOrdersArray.push(individualOrderObject);
                    } else if (createdDate < unixStartDate) {
                        passedReportStartDate = true;
                    }
                });

            } else {
                console.log(`Failed to retrieve orders. Error Code: ${response.status}`);
                throw new Error(`Failed to retrieve orders. Error Code: ${response.status}`);
            }

            if (!jsonList || !jsonList.paging) {
                throw new Error('Invalid response from API');
            }

            offset = offset + 100;
            if (offset >= jsonList.paging.total) {
                passedTotalOrders = true;
            }
            //delay to avoid rate limit
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const csvWriter = createCsvWriter({
            path: `./Accounting_Reports/report_${timestamp}.csv`,
            header: [
                {id: 'INVOICE_CREDIT_NOTE_NUMBER', title: 'INVOICE_CREDIT_NOTE_NUMBER'},
                {id: 'INVOICE_CREDIT_NOTE_DATE', title: 'INVOICE_CREDIT_NOTE_DATE'},
                {id: 'PAYMENT_DATE', title: 'PAYMENT_DATE'},
                {id: 'SUPPLIER_NAME', title: 'SUPPLIER_NAME'},
                {id: 'SUPPLIER_VAT_NUMBER', title: 'SUPPLIER_VAT_NUMBER'},
                {id: 'DEPARTURE_COUNTRY', title: 'DEPARTURE_COUNTRY'},
                {id: 'ARRIVAL_COUNTRY', title: 'ARRIVAL_COUNTRY'},
                {id: 'CUSTOMER_VAT_NUMBER', title: 'CUSTOMER_VAT_NUMBER'},
                {id: 'SERVICE_TYPE', title: 'SERVICE_TYPE'},
                {id: 'GOODS_SERVICE', title: 'GOODS_SERVICE'},
                {id: 'NATURE_OF_TRANSACTION', title: 'NATURE_OF_TRANSACTION'},
                {id: 'SKU', title: 'SKU'},
                {id: 'ITEM_DESCRIPTION', title: 'ITEM_DESCRIPTION'},
                {id: 'GROSS', title: 'GROSS'},
                {id: 'NET', title: 'NET'},
                {id: 'VAT', title: 'VAT'},
                {id: 'CURRENCY', title: 'CURRENCY'},
                {id: 'VAT_RATE_APPLIED', title: 'VAT_RATE_APPLIED'},
                {id: 'SUPPLIER_ESTABLISHED', title: 'SUPPLIER_ESTABLISHED'},
                {id: 'CATEGORY', title: 'CATEGORY'},
                {id: 'PURPOSE_OF_GOODS', title: 'PURPOSE_OF_GOODS'}
            ],

        });

        csvWriter
        .writeRecords(allOrdersArray)
        .then(()=> console.log(`The CSV file was written successfully at: ./Accounting_Reports/report_${timestamp}.csv`));

        res.render('welcome', {
            reportGenerated: true,
            csvName: `report_${timestamp}.csv`
        });

        /////////res for testing///////////
        //res.send(`<pre>${JSON.stringify(jsonList, null, 2)}</pre>`);
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        res.status(500).send(`An error occurred: ${error.message}`);
    }
});

const port = 3003;
app.listen(port, () => {
    console.log(`Hi! Go to the following link in your browser to start the app: http://localhost:${port}`);
    exec(`start http://localhost:${port}`, (err, stdout, stderr) => {
        if (err) {
            console.error(`exec error: ${err}`);
            return;
        }
    });
});