const express = require('express');
const router = express.Router();
const Session = require('../models/session');
const User = require('../models/user');

router.post('/start-session', async (req, res) => {
  try {
    const { serviceId, userId, type } = req.body;

    const user = await User.findById(userId);
    if(!user){
        return res.status(404).json({ error: 'User not found' });
    }

//   const service = await Service.findOne({ _id: serviceId });
//   if (!service) {
//     return res.status(404).json({ error: 'Service not found' });
//   }
  const existingSession = await Session.findOne({
    user: userId || null,
    status: 'active',
    type: type
  })
  if (existingSession) {
    return res.status(200).json({ sessionId: existingSession._id });
  }
  // Create a new session
  const session = new Session({
    user: user?._id || null,
    service: service._id,
    status: 'active',
    type:type
  });

  await session.save();



  res.status(201).json({ sessionId: session._id });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});


router.get('/fetch-session', async (req, res) => {
  const { userid } = req.query;
    if ( !userid) {
      return res.status(401).json({ message: 'No session token provided' });
    }
  
    let find;
  
    try {
      const user = await User.findById(userid);
      if(user){
        find = { user: user._id, status: 'active' };
      }else{
        find = { unregisteredUserToken: token, status: 'active' };
      }
    } catch (error) {
        return res.status(401).json({ message: 'Invalid user ID' });
    }
      
  

  // Fetch the session details from the database
  const session = await Session.find(find).populate('service');

  if (!session) {
    return res.status(404).json({ message: 'Session not found' });
  }

  res.json(session);
});


router.get('/all-sessions', async (req, res) => {
  try {
    const { email } = req.query;

  if (!email ) {
    return res.status(400).json({ message: 'Unauthorized access' });
  }
  const user = await User.findOne({ email });
  if (!user || user.role !== 'admin') {
    return res.status(400).json({ message: 'Unauthorized access' });
  }
  const session = await Session.aggregate([
    {
      $addFields: {
        latestMessageTimestamp: {
          $max: "$messages.timestamp",
        },
        statusSortOrder: {
          $cond: { if: { $eq: ["$status", "active"] }, then: 1, else: 2 },
        },
      },
    },
    {
      $sort: {
        statusSortOrder: 1,
        latestMessageTimestamp: -1,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: { path: "$user", preserveNullAndEmptyArrays: true },
    },
    // Populate user.booking with service details
    {
      $lookup: {
        from: "services",
        localField: "user.booking.service",
        foreignField: "_id",
        as: "user.bookingDetails",
      },
    },
    {
      $addFields: {
        "user.booking": {
          $map: {
            input: "$user.booking",
            as: "bookingItem",
            in: {
              $mergeObjects: [
                "$$bookingItem",
                {
                  serviceDetails: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$user.bookingDetails",
                          as: "service",
                          cond: { $eq: ["$$service._id", "$$bookingItem.service"] },
                        },
                      },
                      0,
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        "user.bookingDetails": 0, // Remove temporary bookingDetails field
      },
    },
  ]);
  
      
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch session', error: error.message });
  }
  
});



router.get('/seen', async (req, res) => {
    const { sessionId } = req.query;
  
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not provided' });
    }
  
    try {
      const session = await Session.findOneAndUpdate(
        { _id: sessionId },
        {
          $set: {
            'messages.$[message].isReadByAdmin': true,
          },
        },
        {
          arrayFilters: [{ 'message.isReadByAdmin': { $ne: true } }],
          new: true,
        }
      );
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      // Correctly update the messages array using map
    //   session.messages = session.messages.map((message) => ({
    //     ...message,
    //     isReadByAdmin: true,
    //   }));
  
    //   await session.save();
      res.json({ message: 'Session marked as seen' });
    } catch (error) {
      console.error('Error marking session as seen:', error);
      res.status(500).json({ message: 'Failed to mark session as seen' });
    }
  });


router.post('/delete', async (req, res) => {
    const { sessionId } = req.body;
  
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not provided' });
    }
  
    try {
      const session = await Session.findOneAndDelete({ _id: sessionId });
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ message: 'Failed to delete session' });
    }
  });



router.post('/end', async (req, res) => {
    const { sessionId } = req.body;
  
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not provided' });
    }
  
    try {
      const session = await Session.findOneAndUpdate({ _id: sessionId }, { status: 'ended' });
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      res.json({ message: 'Session ended successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ message: 'Failed to delete session' });
    }
  });


  module.exports = router;