# Printful Accounting Automation App

This is a simple Node.js application that fetches sales data from the Printful API and generates an accounting spreadsheet. The spreadsheet is formatted to meet the requirements of the client's accountant for preparing EU VAT accounts.

## Features

- Allows the user to choose a date range and then fetches sales data from the Printful API.
- Generates an accounting spreadsheet in CSV format.
- Provides a simple user interface in the browser using Handlebars.
- Packaged into a portable executable file using PKG, allowing the client to run the app on their PC as needed.

## How it Works

The application is initiated by a GET request to the `/getPrintfulOrders` endpoint. This request is made through the browser interface, where the user can specify a date range for the report.

The application fetches sales data from the Printful API, processes the data, and generates a CSV file with the accounting information.

The CSV file is written to the `./Accounting_Reports/` directory.

The user interface is rendered using Handlebars. After the report is generated, a success message is displayed on the page.

## Running the App

The application is packaged into a portable executable file using PKG. This allows the client to run the app on their PC as needed.

## Dependencies

The application uses the following dependencies:

- csv-parser
- csv-writer
- dotenv
- express
- hbs
- node-fetch

## Note

The API key is stored in a `.env` file which is ignored by Git.