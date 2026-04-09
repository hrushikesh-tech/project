const getProducts = async (req, res) => {
    try {
        res.status(200).json([
            { name: "Mobile", price: 10000 },
            { name: "Laptop", price: 50000 },
            { name: "Headphones", price: 2000 }
        ]);
    } catch (err) {
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = {
    getProducts
};