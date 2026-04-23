let requests = [];
let routes = [];

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Destiny backend working");
});

app.post("/requests", (req, res) => {
  const request = {
    id: Date.now(),
    ...req.body
  };

  requests.push(request);

  console.log("Request saved:", request);

  res.json(request);
});

app.get("/requests", (req, res) => {
  res.json(requests);
});

app.post("/routes", (req, res) => {
  const route = {
    id: Date.now(),
    ...req.body
  };

  routes.push(route);

  console.log("Route saved:", route);

  res.json(route);
});

app.get("/match/:routeId", (req, res) => {
  const { routeId } = req.params;

  const route = routes.find(r => r.id == routeId);

  if (!route) {
    return res.status(404).json({ error: "Route not found" });
  }

  const matches = requests.filter(req => {

    // distance from pickup to route endpoints
    const pickupToStart = getDistance(route.start_lat, route.start_lng, req.pickup_lat, req.pickup_lng);
    const pickupToEnd = getDistance(route.end_lat, route.end_lng, req.pickup_lat, req.pickup_lng);

    // distance from drop to route endpoints
    const dropToStart = getDistance(route.start_lat, route.start_lng, req.drop_lat, req.drop_lng);
    const dropToEnd = getDistance(route.end_lat, route.end_lng, req.drop_lat, req.drop_lng);

    return (
      (pickupToStart < 5 || pickupToEnd < 5) &&
      (dropToStart < 5 || dropToEnd < 5)
    );
  });

  res.json(matches);
});
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = app;