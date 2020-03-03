#QR invoices

This script does the following:
* fetch unhandled invoices (based on a "unhandled" label which is applied through email filters)
* extract necessary information 
* generates a QR code
* sends the code in a new email so that it can easily be scanned in a banking app
* removes the "unhandled" label and adds a "handled" label
