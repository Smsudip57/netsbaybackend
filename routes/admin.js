const express = require('express');
const User = require('../models/user');
const Service = require('../models/service')
const Plan = require('../models/plan');
const crypto = require('crypto');
const { default: mongoose } = require('mongoose');
const router = express.Router();



router.get('/generate_id', async (req, res) => {
    try {
        let uniqueId;
        let exists;
        do {
            uniqueId = `PRD${crypto.randomInt(10000, 99999)}`;
            exists = await Plan.findOne({ productId: uniqueId });
        } while (exists);
        return res.status(200).json({ id: uniqueId });
    } catch (error) {
        console.error("Error generating ID:", error);
        return res.status(500).json({ message: "Error generating unique ID" });
    }
});



router.post('/add_product', async(req,res)=>{
    try {
        const {
            productId,
            productName,
            os,
            networkType,
            cpu,
            ram,
            storage,
            ipSet,
            price,
            inStock,
        } = req.body;

        const plan = new Plan({
            productId, 
            productName,
            Os:os,  
            serviceType: networkType, 
            cpu: Number(cpu), 
            ram: Number(ram),
            storage: Number(storage),
            ipSet,
            price: Number(price),
            stock: Boolean(inStock),
        });
        await plan.save();

        return res.status(201).json({ success: true, message: 'Plan added successfully' });
    } catch (error) {
        console.error("Error adding service:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
})


router.post('/stock_product', async (req, res) => {
    try {
        const { productId, value } = req.body;
        if(!productId || value === undefined || value === null){
            return res.status(400).json({ message: 'Product ID and value are required' });
        }
        const deletedPlan = await Plan.findOneAndUpdate({ productId: productId }, { stock: value }, { new: true });
        if (!deletedPlan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        return res.status(200).json({ message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('Error deleting plan:', error);
        return res.status(500).json({ message: 'Failed to delete plan' });
    }
});

router.post('/delete_product', async (req, res) => {
    try {
        const { productId } = req.body;
        if(!productId){
            return res.status(400).json({ message: 'Product ID is required' });
        }
        const deletedPlan = await Plan.findOneAndDelete({ productId: productId });
        if (!deletedPlan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        return res.status(200).json({ message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('Error deleting plan:', error);
        return res.status(500).json({ message: 'Failed to delete plan' });
    }
});


router.post('/update_product', async (req, res) => {
    try {
        const { 
            productId,
            productName,
            os,
            networkType,
            cpu,
            ram,
            storage,
            ipSet,
            price,
            inStock
        } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        if (!productName && !os && !networkType && !cpu && !ram && !storage && !ipSet && !price && inStock === undefined) {
            return res.status(400).json({ message: 'No update data provided' });
        }

        const updateData = {};
        if (productName) updateData.productName = productName;
        if (os) updateData.Os = os;
        if (networkType) updateData.serviceType = networkType;
        if (cpu) updateData.cpu = Number(cpu);
        if (ram) updateData.ram = Number(ram);
        if (storage) updateData.storage = Number(storage);
        if (ipSet) updateData.ipSet = ipSet;
        if (price) updateData.price = Number(price);
        if (inStock !== undefined) updateData.stock = Boolean(inStock);

        const updatedPlan = await Plan.findOneAndUpdate(
            { productId },
            { $set: updateData }, 
            { new: true } 
        );

        if (!updatedPlan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        return res.status(200).json({ message: 'Plan updated successfully', updatedPlan });
    } catch (error) {
        console.error('Error updating plan:', error);
        return res.status(500).json({ message: 'Failed to update plan' });
    }
});



router.post('/add_services', async(req,res)=>{
    try {
        console.log(req.body);
        if (!Array.isArray(req.body) || req.body.length === 0) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        const productType = req.body[0].productType;
        const relatedProduct = await Plan.findOne({ productId: productType });

        if (!relatedProduct) {
            return res.status(400).json({ message: "Could not find related product" });
        }

        const generate_id = new Set();

        async function generateUniqueServiceId() {
            let uniqueId;
            let exists;
            do {
                uniqueId = `SID${crypto.randomInt(10000, 99999)}`;
                exists = await Service.findOne({ serviceId: uniqueId });
            } while (exists || generate_id.has(uniqueId));
            
            generate_id.add(uniqueId);
            return uniqueId;
        }

        const values = await Promise.all(req.body.map(async (item) => {
            return {
                relatedProduct: relatedProduct._id,
                serviceId: await generateUniqueServiceId(), 
                vmID: item.vmId || null,
                purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
                purchedFrom: item.purchaseProvider || null,
                EXTRLhash: item.hashCode || null,
                ipAddress: item.ipAddress || null,
                username: item.username || null,
                password: item.password || null,
            };
        }));

        const services = await Service.insertMany(values);
        return res.status(201).json({ 
            title: "Success", 
            message: "Services added successfully", 
            services 
        });

    } catch (error) {
        console.error("Error inserting services:", error);
        if(error instanceof mongoose.Error.ValidationError){
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
})

module.exports = router;