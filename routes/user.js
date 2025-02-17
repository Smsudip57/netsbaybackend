const express = require('express');
const User = require('../models/user');
const Plan = require('../models/plan');
const router = express.Router();


router.get('/all_plans', async (req, res) => {
    try {
        const plans = await Plan.find();
        return res.status(200).json(plans);
    } catch (error) {
        console.error('Error fetching plans:', error);
        return res.status(500).json({ message: 'Failed to fetch plans' });
    }
});

router.get('/get_product',async(req,res)=>{
    try {
        const {productId} = req.query
        if(!productId){
            return res.status(400).json({ message: 'Product ID is required' });
        }
        const plan = await Plan.findOne({ productId: productId });
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }
        return res.status(200).json(plan);
    } catch (error) {
        console.error('Error getting plan:', error);
        return res.status(500).json({ message: 'Failed to get plan' });
    }
})


module.exports = router;