const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// laptop 2

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wrydc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("Blood-wave").collection("users");
    const newsletterCollection = client
      .db("Blood-wave")
      .collection("newsletter");
    const bloodRequestCollection = client
      .db("Blood-wave")
      .collection("blood-request");
    const taskCollection = client.db("Blood-wave").collection("task");
    const completedTaskCollection = client
      .db("Blood-wave")
      .collection("completed-task");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbiddedn Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      next();
    };

    // verify donor after token
    const verifyDonor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isDonor = user?.role === "donor";
      if (!isDonor) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      next();
    };

    // get admin..........
    app.get("/users/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // get donor ..........
    app.get("/users/user/donor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let donor = false;
      if (user) {
        donor = user?.role === "donor";
      }
      res.send({ donor });
    });

    // get member ...........
    app.get("/users/user/member/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let member = false;
      if (user) {
        member = user?.role === "member";
      }
      res.send({ member });
    });

    // create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User Already Exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get singleUser by email
    app.get("/users/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await usersCollection.findOne(filter);
      res.send(result);
    });

    // Get completed blood requests for a member
    app.get("/bloodRecive/completed/:email", async (req, res) => {
      const memberEmail = req.params.email;

      const member = await usersCollection.findOne({ email: memberEmail });
      if (!member) return res.status(404).send({ error: "Member not found" });

      const completedRequests = await completedTaskCollection
        .find({ "requestDetails.senderid": member._id.toString() })
        .toArray();

      res.send(completedRequests);
    });

    // donor howar jonno data update
    app.patch("/users/user/become-donor/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send(result);
    });

    // get donor
    app.get("/find-donor", async (req, res) => {
      const { bloodGroup, district, page = 1, limit = 10 } = req.query;
      const query = {
        role: "donor",
        status: "active",
        availability: "available",
      };
      const query2 = { role: "donor" };
      if (bloodGroup) query.bloodGroup = bloodGroup;
      if (district) query.district = district;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const donors = await usersCollection
        .find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
      const total = await usersCollection.countDocuments(query2);
      const activeTotal = await usersCollection.countDocuments(query);
      res.send({
        total,
        activeTotal,
        page: parseInt(page),
        limit: parseInt(limit),
        data: donors,
      });
    });

    app.get("/stats", async (req, res) => {
      const query = { role: "donor" };
      const query2 = {
        role: "donor",
        status: "active",
        availability: "available",
      };
      const totalUser = await usersCollection.countDocuments();
      const donor = await usersCollection.countDocuments(query);
      const activeDonor = await usersCollection.countDocuments(query2);
      const totalBloodReq = await bloodRequestCollection.countDocuments();
      res.send({ totalUser, donor, activeDonor, totalBloodReq });
    });

    // get singleUser by email for Profile page
    app.get("/users/user/profile/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await usersCollection.findOne(filter);
      res.send(result);
    });

    // donor howar jonno data update
    app.patch("/users/user/profile/edit/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.send(result);
    });

    // For admin all user
    app.get(
      "/users/allUser/by/admin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const allUser = await usersCollection.find().toArray();
        // console.log(allUser);
        res.send(allUser);
      }
    );

    app.patch("/users/user/status/:id", async (req, res) => {
      const id = req.params.id;
      const user = await usersCollection.findOne({ _id: new ObjectId(id) });
      if (!user) {
        res.status(404).send({ message: "User not found" });
      }
      const newStatus = user.status === "active" ? "blocked" : "active";
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: newStatus } }
      );
      res.send(result);
    });

    app.delete(
      "/users/user/delete/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = { _id: new ObjectId(req.params.id) };
        const result = await usersCollection.deleteOne(id);
        res.send(result);
      }
    );

    app.get(
      "/users/allDonor/by/admin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const donors = await usersCollection
          .aggregate([
            { $match: { role: "donor" } },
            {
              $lookup: {
                from: "blood-request",
                let: { donorId: { $toString: "$_id" } }, // convert ObjectId to string
                pipeline: [
                  { $match: { $expr: { $eq: ["$reciverid", "$$donorId"] } } },
                ],
                as: "requests",
              },
            },
            {
              $addFields: {
                totalRequest: { $size: "$requests" },
                pendingRequest: {
                  $size: {
                    $filter: {
                      input: "$requests",
                      as: "r",
                      cond: { $eq: ["$$r.status", "pending"] },
                    },
                  },
                },
                acceptedRequests: {
                  $size: {
                    $filter: {
                      input: "$requests",
                      as: "r",
                      cond: { $eq: ["$$r.status", "accepted"] },
                    },
                  },
                },
                rejectedRequests: {
                  $size: {
                    $filter: {
                      input: "$requests",
                      as: "r",
                      cond: { $eq: ["$$r.status", "rejected"] },
                    },
                  },
                },
              },
            },
            {
              $project: {
                requests: 0, // hide request details
              },
            },
          ])
          .toArray();
        res.send(donors);
      }
    );

    app.post("/req-donor-blood/:email", async (req, res) => {
      const userEmail = req.params.email;
      const user = await usersCollection.findOne({ email: userEmail });
      const { donorId } = req.body;
      const message = req.body.message;
      const emergencyType = req.body.emergencyType;
      const needDate = req.body.needDate;
      const donor = await usersCollection.findOne({
        _id: new ObjectId(donorId),
      });

      if (!user || !donor) {
        return res
          .status(404)
          .send({ success: false, message: "User or donor not found" });
      }

      const bloodRequestInfo = {
        sendername: user.name || "",
        senderid: user._id.toString(),
        senderemail: user.email || "",
        senderimage: user.image || "",
        senderphone: user.phone || "",
        message: message,
        emergencyType: emergencyType,
        needDate: needDate,
        status: "pending",
        requestTime: new Date(),

        recivername: donor.name || "",
        reciverid: donor._id.toString(),
        reciveremail: donor.email || "",
        reciverimage: donor.image || "",
        reciverphone: donor.phone || "",
        bloodGroup: donor.bloodGroup || "",
      };

      const result = await bloodRequestCollection.insertOne(bloodRequestInfo);
      res.send(result);
    });

    // For user ..............
    app.get("/my-blood-requests", async (req, res) => {
      const userEmail = req.query.email;
      const query = { senderemail: userEmail };
      const requests = await bloodRequestCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      // console.log(requests);
      res.send(requests);
    });

    // for Donor.........................
    app.get(
      "/blood-requests/donor",
      verifyToken,
      verifyDonor,
      async (req, res) => {
        const userEmail = req.query.email;
        const query = { reciveremail: userEmail, status: "pending" };
        // console.log(userEmail);
        const requests = await bloodRequestCollection.find(query).toArray();
        // console.log(requests);
        res.send(requests);
      }
    );

    app.patch(
      "/blood-requests/:id",
      verifyToken,
      verifyDonor,
      async (req, res) => {
        const id = req.params.id;
        const { status, donorId } = req.body;
        if (!status || !["pending", "accepted", "rejected"].includes(status)) {
          return res.status(400).send({ error: "Invalid status value" });
        }
        const filter = { _id: new ObjectId(id) };
        const updateFields = { status, statusTime: new Date() };
        const updateDoc = { $set: updateFields };
        const requestUpdateResult = await bloodRequestCollection.updateOne(
          filter,
          updateDoc
        );

        if (status === "accepted" && donorId) {
          await usersCollection.updateOne(
            { _id: new ObjectId(donorId) },
            { $set: { availability: "unavailable" } }
          );

          await taskCollection.deleteMany({ donorId: new ObjectId(donorId) });

          const donorData = await usersCollection.findOne({
            _id: new ObjectId(donorId),
          });

          await taskCollection.insertOne({
            donorId: donorData._id,
            name: donorData.name,
            email: donorData.email,
            bloodRequestId: id,
            acceptedAt: new Date(),
            status: "pending",
          });
        }
        res.send({ message: "Blood request updated", requestUpdateResult });
      }
    );

    app.get(
      "/blood-requests/donor/status",
      verifyToken,
      verifyDonor,
      async (req, res) => {
        const userEmail = req.query.email;
        const query = { reciveremail: userEmail };
        // console.log(userEmail)
        const requests = await bloodRequestCollection.find(query).toArray();
        // console.log(requests);
        res.send(requests);
      }
    );

    // this is for Task page
    app.get("/task/:email", verifyToken, verifyDonor, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await taskCollection.findOne(filter);
      res.send(result);
    });
    // this is for Task page
    app.get("/request/:id", verifyToken, verifyDonor, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await bloodRequestCollection.findOne(filter);
      res.send(result);
    });

    // For completed Task after click complete btn
    app.patch(
      "/task/complete/:id",
      verifyToken,
      verifyDonor,
      async (req, res) => {
        const id = req.params.id;
        const { donorId, requestId } = req.body;

        if (!donorId || !requestId) {
          return res
            .status(400)
            .send({ error: "donorId and requestId required" });
        }

        const taskUpdateResult = await taskCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "completed", completedAt: new Date() } }
        );

        const userUpdateResult = await usersCollection.updateOne(
          { _id: new ObjectId(donorId) },
          { $set: { availability: "available", lastDonation: new Date() } }
        );

        const taskData = await taskCollection.findOne({
          _id: new ObjectId(id),
        });
        const requestData = await bloodRequestCollection.findOne({
          _id: new ObjectId(requestId),
        });

        await completedTaskCollection.insertOne({
          ...taskData,
          requestDetails: requestData,
          completedAt: new Date(),
        });

        await taskCollection.deleteOne({ _id: new ObjectId(id) });

        res.send({
          message: "Task completed and donor availability updated",
          taskUpdateResult,
          userUpdateResult,
        });
      }
    );

    // For my completed task page
    app.get(
      "/mytask/completed/:email",
      verifyToken,
      verifyDonor,
      async (req, res) => {
        const email = req.params.email;
        // console.log(email);
        const filter = { email: email };
        const result = await completedTaskCollection.find(filter).toArray();
        res.send(result);
      }
    );

    // for admin -->  all completed blood donation
    app.get(
      "/admin/allCompletedBloodDonation",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await completedTaskCollection.find().toArray();
        res.send(result);
      }
    );

    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const totalUser = await usersCollection.countDocuments();
      const totalAdmin = await usersCollection.countDocuments({
        role: "admin",
      });
      const totalDonor = await usersCollection.countDocuments({
        role: "donor",
      });
      const totalMember = await usersCollection.countDocuments({
        role: "member",
      });
      const activeUser = await usersCollection.countDocuments({
        status: "active",
      });
      const blockedUser = await usersCollection.countDocuments({
        status: "blocked",
      });

      const activeDonor = await usersCollection.countDocuments({
        role: "donor",
        status: "active",
        availability: "available",
      });
      const unavailableDonor = await usersCollection.countDocuments({
        role: "donor",
        availability: "unavailable",
      });

      const totalBloodReq = await bloodRequestCollection.countDocuments();
      const pendingRequest = await bloodRequestCollection.countDocuments({
        status: "pending",
      });
      const acceptedRequest = await bloodRequestCollection.countDocuments({
        status: "accepted",
      });
      const rejectedRequest = await bloodRequestCollection.countDocuments({
        status: "rejected",
      });

      const totalTaskAssigned = await taskCollection.countDocuments();
      const completedTask = await completedTaskCollection.countDocuments();

      res.send({
        totalUser,
        totalAdmin,
        totalDonor,
        totalMember,
        activeUser,
        blockedUser,
        activeDonor,
        unavailableDonor,
        totalBloodReq,
        pendingRequest,
        acceptedRequest,
        rejectedRequest,
        totalTaskAssigned,
        completedTask,
      });
    });

    // POST /newsletter
    app.post("/newsletter", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ error: "Email is required" });

      const existing = await newsletterCollection.findOne({ email });
      if (existing) return res.send({ message: "Already subscribed" });

      const result = await newsletterCollection.insertOne({
        email,
        createdAt: new Date(),
      });
      res.send({ message: "Subscribed successfully!", data: result });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Blood-Wave Is Open For Service");
});

app.listen(port, () => {
  console.log(`Blood-Wave is running on Port: ${port}`);
});
