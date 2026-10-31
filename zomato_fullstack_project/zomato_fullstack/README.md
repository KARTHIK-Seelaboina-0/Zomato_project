# QuickBite — Full-stack food delivery project

A beginner-friendly Zomato-style demo built with **Python Flask**, **SQLite**, HTML, CSS and JavaScript.

## Features

- Customer: search and filter restaurants, browse menus, add/remove cart items, place orders.
- Discount: 10% off the food subtotal when it is at least ₹500.
- Admin: see orders, restaurants and menu items; update order statuses and menu prices.
- Restaurant dashboard: select a restaurant, update prices, and manage order status.
- Delivery dashboard: view eligible orders and update delivery status.
- SQLite database is created automatically as `zomato.db` when the app starts.
- Responsive UI with animated food art, card transitions, modal effects and toast messages.

## Requirements

- Python 3.10 or newer
- pip

## Run on Windows

1. Extract the ZIP.
2. Open the `zomato_fullstack` folder in VS Code.
3. Open Terminal → New Terminal.
4. Create a virtual environment (recommended):

   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   ```

5. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

6. Start the server:

   ```powershell
   python app.py
   ```

7. Open **http://127.0.0.1:5000** in your browser.

Keep the terminal running while you use the app. Do not open `templates/index.html` directly; it must be served by Flask.

## Project structure

```text
zomato_fullstack/
├── app.py                 # Flask routes, validation, SQLite logic
├── requirements.txt
├── README.md
├── zomato.db              # Created automatically on first run
├── templates/
│   └── index.html         # Main UI
└── static/
    ├── style.css          # Layout, responsive styles and animations
    └── app.js             # Cart, filters, API calls and dashboards
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check server/database |
| GET | `/api/restaurants` | Restaurants and menus |
| POST | `/api/orders` | Validate and create an order |
| GET | `/api/orders?role=admin` | List all orders |
| GET | `/api/orders?role=restaurant&restaurant_id=1` | Orders for one restaurant |
| GET | `/api/orders?role=delivery` | Orders ready for delivery |
| PATCH | `/api/orders/<id>/status` | Update order status |
| PATCH | `/api/orders/<id>/delivery` | Update delivery status |
| PATCH | `/api/foods/<id>` | Update food price |

## Important project notes

- This is an educational demo. Role tabs are **not protected by login**; anyone using the app can open them. Add authentication and server-side role authorization before deployment.
- No real payment gateway, SMS, GPS tracking or actual delivery-partner assignment is implemented.
- The phone number is collected as demo order contact information; use fake test data while learning.
- Flask debug mode is enabled for local development only. Disable it and use a production WSGI server before deploying.
- To reset all demo data, stop the server and delete `zomato.db`; it will be recreated with sample data on the next run.
"# Zomato_project" 
