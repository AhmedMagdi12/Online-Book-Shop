const fs = require("fs");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const pdfDocument = require("pdfkit");
const Product = require("../models/product");
const Order = require("../models/order");

exports.getProducts = (req, res, next) => {
    Product.find()
        .then((products) => {
            console.log(products);
            res.render("shop/product-list", {
                prods: products,
                pageTitle: "All Products",
                path: "/products",
            });
        })
        .catch((err) => {
            console.log(err);
        });
};

exports.getProduct = (req, res, next) => {
    const prodId = req.params.productId;
    Product.findById(prodId)
        .then((product) => {
            res.render("shop/product-detail", {
                product: product,
                pageTitle: product.title,
                path: "/products",
            });
        })
        .catch((err) => console.log(err));
};

exports.getIndex = (req, res, next) => {
    Product.find()
        .then((products) => {
            res.render("shop/index", {
                prods: products,
                pageTitle: "Shop",
                path: "/",
            });
        })
        .catch((err) => {
            console.log(err);
        });
};

exports.getCart = (req, res, next) => {
    req.user
        .populate("cart.items.productId")
        .execPopulate()
        .then((user) => {
            const products = user.cart.items;
            res.render("shop/cart", {
                path: "/cart",
                pageTitle: "Your Cart",
                products: products,
            });
        })
        .catch((err) => console.log(err));
};

exports.postCart = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId)
        .then((product) => {
            return req.user.addToCart(product);
        })
        .then((result) => {
            console.log(result);
            res.redirect("/cart");
        });
};

exports.postCartDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    req.user
        .removeFromCart(prodId)
        .then((result) => {
            res.redirect("/cart");
        })
        .catch((err) => console.log(err));
};

exports.getCheckout = (req, res, next) => {
    let products;
    let total;

    req.user
        .populate("cart.items.productId")
        .execPopulate()
        .then((user) => {
            products = user.cart.items;
            total = 0;
            products.forEach((p) => (total += p.quantity * p.productId.price));

            return stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: products.map(p => { 
                    return {
                    name: p.productId.title, 
                    description: p.productId.description, 
                    amount: p.productId.price * 100, 
                    quantity: p.quantity, 
                    currency:'usd'
                    }
                }), 
                success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
                cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
                
            });
        })
        .then((session) => {
            res.render("shop/checkout", {
                path: "/checkout",
                pageTitle: "Checkout",
                products: products,
                totalSum: total,
                sessionId: session.id
            });
        })
        .catch((err) => console.log(err));
};
exports.postOrder = (req, res, next) => {
    req.user
        .populate("cart.items.productId")
        .execPopulate()
        .then((user) => {
            const products = user.cart.items.map((i) => {
                return { quantity: i.quantity, product: { ...i.productId._doc } };
            });
            const order = new Order({
                user: {
                    email: req.user.email,
                    userId: req.user,
                },
                products: products,
            });
            return order.save();
        })
        .then((result) => {
            return req.user.clearCart();
        })
        .then(() => {
            res.redirect("/orders");
        })
        .catch((err) => console.log(err));
};

exports.getCheckoutSuccess = (req, res, next) => {
    req.user
        .populate("cart.items.productId")
        .execPopulate()
        .then((user) => {
            const products = user.cart.items.map((i) => {
                return { quantity: i.quantity, product: { ...i.productId._doc } };
            });
            const order = new Order({
                user: {
                    email: req.user.email,
                    userId: req.user,
                },
                products: products,
            });
            return order.save();
        })
        .then((result) => {
            return req.user.clearCart();
        })
        .then(() => {
            res.redirect("/orders");
        })
        .catch((err) => console.log(err));
};

exports.getOrders = (req, res, next) => {
    Order.find({ "user.userId": req.user._id })
        .then((orders) => {
            res.render("shop/orders", {
                path: "/orders",
                pageTitle: "Your Orders",
                orders: orders,
            });
        })
        .catch((err) => console.log(err));
};

exports.getInvoice = (req, res, next) => {
    const orderId = req.params.orderId;
    Order.findById(orderId)
        .then((order) => {
            if (!order) {
                return next(new Error("No order found"));
            }

            if (order.user.userId.toString() !== req.user._id.toString()) {
                return new Error("Unauthorized");
            }
            const invoiceName = "invoice-" + orderId + ".pdf";
            const invoicePath = path.join("data", "invoices", invoiceName);
            console.log(invoicePath);
            console.log("1");

            const pdfDoc = new pdfDocument();

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                'inline; filename="' + invoiceName + '"'
            );
            //   res.send(data);
            // stored on server
            pdfDoc.pipe(fs.createWriteStream(invoicePath));
            // return to client
            pdfDoc.pipe(res);
            // write line of text inside
            // font size
            pdfDoc.fontSize(26).text("Invoice", {
                underline: true,
            });

            pdfDoc.text("--------------------");
            let totalPrice = 0;
            order.products.forEach((product) => {
                totalPrice += product.quantity * product.product.price;
                pdfDoc.text(
                    product.product.title +
                    "-" +
                    product.quantity +
                    " x " +
                    "$" +
                    product.product.price
                );
            });
            pdfDoc.text("Total price : $" + totalPrice);
            // end
            pdfDoc.end();

            // const file = fs.createReadStream(invoicePath);
            // res.setHeader('Content-Type', 'application/pdf');
            // res.setHeader('Content-disposition', 'attachment; filename="'+ invoiceName + '"')
            // file.pipe(res);

            // read into memory
            // fs.readFile(invoicePath, (err, data ) => {
            //     if(err) return next(err);
            //     res.setHeader('Content-Type', 'application/pdf');
            //     res.setHeader('Content-disposition', 'attachment; filename="'+ invoiceName + '"')
            //     res.send(data);
            // });
        })
        .catch((err) => next(err));
};
