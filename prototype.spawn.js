Spawn.prototype.calcCreepCost = function (body) {
  let cost = 0
  for (const part of body) {
    cost += BODYPART_COST[part]
  }
  return cost
};

Spawn.prototype.enoughEnergyToSpawn = function (body) {
  let cost = 0
  for (const part of body) {
    cost += BODYPART_COST[part]
  }
  return cost <= this.room.energyAvailable
};
