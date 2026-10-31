from flask import Flask, jsonify, render_template, request
import sqlite3
from pathlib import Path
from datetime import datetime

app = Flask(__name__)
DB_PATH = Path(__file__).with_name("zomato.db")

RESTAURANTS = [
    ("Spice Hub", "Indian", "🍛", "20–30 min"),
    ("Pizza Palace", "Italian", "🍕", "25–35 min"),
    ("Burger Barn", "American", "🍔", "20–30 min"),
    ("Dragon Wok", "Chinese", "🥡", "25–35 min"),
    ("Tandoori Treats", "North Indian", "🍗", "30–40 min"),
    ("Dosa Corner", "South Indian", "🥞", "15–25 min"),
    ("Sweet Cravings", "Desserts", "🍰", "15–25 min"),
]
MENUS = {
    1: [("Chicken Biryani", 180, "🍛"), ("Veg Fried Rice", 120, "🍚"), ("Paneer Curry", 150, "🥘"), ("Ice Cream", 60, "🍨")],
    2: [("Margherita Pizza", 250, "🍕"), ("Classic Burger", 120, "🍔"), ("Pasta Alfredo", 180, "🍝")],
    3: [("Cheese Burger", 150, "🍔"), ("French Fries", 90, "🍟"), ("Chicken Burger", 180, "🍔"), ("Cold Coffee", 100, "🥤")],
    4: [("Hakka Noodles", 130, "🍜"), ("Veg Manchurian", 160, "🥢"), ("Spring Rolls", 100, "🥠"), ("Fried Rice", 140, "🍚")],
    5: [("Butter Chicken", 240, "🍗"), ("Butter Naan", 40, "🫓"), ("Paneer Tikka", 180, "🧀"), ("Dal Makhani", 160, "🥘")],
    6: [("Masala Dosa", 100, "🥞"), ("Idli Sambar", 60, "🍘"), ("Medu Vada", 70, "🍩"), ("Uttapam", 110, "🫓")],
    7: [("Chocolate Cake", 120, "🍰"), ("Brownie", 90, "🍫"), ("Gulab Jamun", 60, "🍮"), ("Vanilla Ice Cream", 70, "🍨")],
}
ORDER_STATUSES = ["Order Placed", "Preparing", "Ready for Pickup", "Out for Delivery", "Delivered", "Cancelled"]
DELIVERY_STATUSES = ["Assigned", "Picked Up", "Out for Delivery", "Delivered"]


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with connect_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS restaurants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cuisine TEXT NOT NULL,
            emoji TEXT NOT NULL,
            delivery_time TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
            name TEXT NOT NULL,
            price REAL NOT NULL CHECK(price > 0),
            emoji TEXT NOT NULL,
            available INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_code TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
            subtotal REAL NOT NULL,
            discount REAL NOT NULL,
            total REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'Order Placed',
            delivery_status TEXT NOT NULL DEFAULT 'Unassigned',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            food_id INTEGER NOT NULL REFERENCES foods(id),
            food_name TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL CHECK(quantity > 0)
        );
        """)
        if db.execute("SELECT COUNT(*) FROM restaurants").fetchone()[0] == 0:
            for name, cuisine, emoji, delivery_time in RESTAURANTS:
                db.execute(
                    "INSERT INTO restaurants(name,cuisine,emoji,delivery_time) VALUES(?,?,?,?)",
                    (name, cuisine, emoji, delivery_time),
                )
            for restaurant_id, items in MENUS.items():
                for name, price, emoji in items:
                    db.execute(
                        "INSERT INTO foods(restaurant_id,name,price,emoji) VALUES(?,?,?,?)",
                        (restaurant_id, name, price, emoji),
                    )


def restaurant_dict(row):
    return {key: row[key] for key in row.keys()}


def order_dict(db, row):
    result = {key: row[key] for key in row.keys()}
    result["items"] = [
        dict(item) for item in db.execute(
            "SELECT food_name AS name, price, quantity, (price * quantity) AS line_total "
            "FROM order_items WHERE order_id=? ORDER BY id", (row["id"],)
        ).fetchall()
    ]
    return result


@app.route("/")
def home():
    return render_template("index.html")


@app.get("/api/restaurants")
def get_restaurants():
    with connect_db() as db:
        restaurants = db.execute("SELECT * FROM restaurants ORDER BY id").fetchall()
        output = []
        for r in restaurants:
            item = restaurant_dict(r)
            item["menu"] = [
                restaurant_dict(f) for f in db.execute(
                    "SELECT id, restaurant_id, name, price, emoji, available FROM foods "
                    "WHERE restaurant_id=? AND available=1 ORDER BY id", (r["id"],)
                ).fetchall()
            ]
            output.append(item)
    return jsonify(output)


@app.post("/api/orders")
def create_order():
    data = request.get_json(silent=True) or {}
    customer_name = str(data.get("customer_name", "")).strip()
    phone = str(data.get("phone", "")).strip()
    items = data.get("items", [])
    if not customer_name:
        return jsonify(error="Please enter your name."), 400
    if not phone or len(phone) < 7:
        return jsonify(error="Please enter a valid phone number."), 400
    if not isinstance(items, list) or not items:
        return jsonify(error="Your cart is empty."), 400

    quantities = {}
    try:
        for item in items:
            food_id = int(item["food_id"])
            quantity = int(item["quantity"])
            if quantity < 1 or quantity > 50:
                raise ValueError
            quantities[food_id] = quantities.get(food_id, 0) + quantity
    except (KeyError, TypeError, ValueError):
        return jsonify(error="Invalid food item or quantity."), 400

    with connect_db() as db:
        placeholders = ",".join("?" for _ in quantities)
        foods = db.execute(
            f"SELECT id, restaurant_id, name, price FROM foods WHERE available=1 AND id IN ({placeholders})",
            tuple(quantities.keys()),
        ).fetchall()
        if len(foods) != len(quantities):
            return jsonify(error="One or more items are unavailable. Refresh and try again."), 400
        restaurant_ids = {f["restaurant_id"] for f in foods}
        if len(restaurant_ids) != 1:
            return jsonify(error="Please place one order from a single restaurant at a time."), 400

        subtotal = sum(float(f["price"]) * quantities[f["id"]] for f in foods)
        discount = round(subtotal * 0.10, 2) if subtotal >= 500 else 0
        total = round(subtotal - discount, 2)
        restaurant_id = next(iter(restaurant_ids))
        order_code = "ZM" + datetime.now().strftime("%y%m%d%H%M%S%f")[-12:]
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor = db.execute(
            "INSERT INTO orders(order_code,customer_name,phone,restaurant_id,subtotal,discount,total,status,delivery_status,created_at) "
            "VALUES(?,?,?,?,?,?,?,'Order Placed','Unassigned',?)",
            (order_code, customer_name, phone, restaurant_id, subtotal, discount, total, created_at),
        )
        order_id = cursor.lastrowid
        for food in foods:
            db.execute(
                "INSERT INTO order_items(order_id,food_id,food_name,price,quantity) VALUES(?,?,?,?,?)",
                (order_id, food["id"], food["name"], food["price"], quantities[food["id"]]),
            )
        row = db.execute(
            "SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=?",
            (order_id,),
        ).fetchone()
        result = order_dict(db, row)
    return jsonify(result), 201


@app.get("/api/orders")
def get_orders():
    role = request.args.get("role", "admin")
    restaurant_id = request.args.get("restaurant_id", type=int)
    with connect_db() as db:
        query = "SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id=o.restaurant_id"
        params = []
        if role == "restaurant" and restaurant_id:
            query += " WHERE o.restaurant_id=?"
            params.append(restaurant_id)
        elif role == "delivery":
            query += " WHERE o.status IN ('Ready for Pickup','Out for Delivery')"
        query += " ORDER BY o.id DESC"
        rows = db.execute(query, params).fetchall()
        return jsonify([order_dict(db, row) for row in rows])


@app.patch("/api/orders/<int:order_id>/status")
def update_order_status(order_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", ""))
    if status not in ORDER_STATUSES:
        return jsonify(error="Unknown order status."), 400
    with connect_db() as db:
        existing = db.execute("SELECT id FROM orders WHERE id=?", (order_id,)).fetchone()
        if not existing:
            return jsonify(error="Order not found."), 404
        db.execute("UPDATE orders SET status=? WHERE id=?", (status, order_id))
        if status == "Ready for Pickup":
            db.execute("UPDATE orders SET delivery_status='Assigned' WHERE id=? AND delivery_status='Unassigned'", (order_id,))
        if status == "Delivered":
            db.execute("UPDATE orders SET delivery_status='Delivered' WHERE id=?", (order_id,))
        row = db.execute(
            "SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=?",
            (order_id,),
        ).fetchone()
        return jsonify(order_dict(db, row))


@app.patch("/api/orders/<int:order_id>/delivery")
def update_delivery_status(order_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", ""))
    if status not in DELIVERY_STATUSES:
        return jsonify(error="Unknown delivery status."), 400
    order_status = {
        "Assigned": "Ready for Pickup",
        "Picked Up": "Out for Delivery",
        "Out for Delivery": "Out for Delivery",
        "Delivered": "Delivered",
    }[status]
    with connect_db() as db:
        existing = db.execute("SELECT id FROM orders WHERE id=?", (order_id,)).fetchone()
        if not existing:
            return jsonify(error="Order not found."), 404
        db.execute("UPDATE orders SET delivery_status=?, status=? WHERE id=?", (status, order_status, order_id))
        row = db.execute(
            "SELECT o.*, r.name AS restaurant_name FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=?",
            (order_id,),
        ).fetchone()
        return jsonify(order_dict(db, row))


@app.patch("/api/foods/<int:food_id>")
def update_food(food_id):
    data = request.get_json(silent=True) or {}
    try:
        price = float(data.get("price"))
    except (TypeError, ValueError):
        return jsonify(error="Enter a valid price."), 400
    if price <= 0 or price > 100000:
        return jsonify(error="Price must be between ₹1 and ₹100000."), 400
    with connect_db() as db:
        row = db.execute("SELECT * FROM foods WHERE id=?", (food_id,)).fetchone()
        if not row:
            return jsonify(error="Food item not found."), 404
        db.execute("UPDATE foods SET price=? WHERE id=?", (price, food_id))
        updated = db.execute("SELECT * FROM foods WHERE id=?", (food_id,)).fetchone()
        return jsonify(restaurant_dict(updated))


@app.get("/api/health")
def health():
    return jsonify(status="ok", database="sqlite")


init_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
