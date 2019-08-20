const CREEP_TYPE = {
  //creep type: civilian or military
  civilian: runCivilian,
  military: runMilitary
}

const CIVILIAN_ROLE = {
  //creep's work itself, building, upgrading, etc.
  supply_energy: supplyEnergy,
  transfer: supplyEnergy,
  inter_room_transfer: interRoomCaravan,
  storage: supplyEnergy,
  build: buildStructure,
  remote_build: buildStructure,
  repair: repairStructure,
  upgrade: improveController,
  worship: worship,
  farming: require('role.farmer'),
  claim: require('role.conquistador'),
  reserve: require('role.colonialist')
}

Creep.prototype.getAssignment = function () {
  const TYPE = {
    peasant: [JOB.UPGRADE, JOB.SUPPLY, JOB.BUILD, JOB.REPAIR],
    craftsman: [JOB.BUILD, JOB.REPAIR],
    caravan: [JOB.SUPPLY, JOB.TRANSFER, JOB.STORAGE],
    conquistador: [JOB.CLAIM],
    melee: [JOB.ATTACK]
  }
  let village = villages[this.room.name]
  let assignment = _.filter(village.assignments, (a) => TYPE[this.memory.role].includes(a.type)).shift()
  _.remove(village.assignments, (a) => a == assignment)
  if (this.getActiveBodyparts(WORK) && this.room.controller.my) assignment = assignment || new Assignment(JOB.UPGRADE, village.room.controller.id, village.name)
  this.memory.assignment = assignment // || new Assignment(JOB.UPGRADE, village.room.controller.id, village.name)
  if (this.memory.assignment) this.say(`${this.memory.assignment.type}`)
};

Creep.prototype.wakeUp = function () {
  let type = this.memory.type
  if (CREEP_TYPE[type]) {
    CREEP_TYPE[type](this)
  }
  else {
    console.log(`${this.name} has unexpected type`);
  }
};

Creep.prototype.eatBreakfast = function () {
  // Check if already has target
  let village = villages[this.room.name]
  if (!this.memory.energy.id) {
    let energyLists = []
    for (const drop of village.droppedEnergies) {
      let amountWeight = drop.amount < 100 ? 40 : 0
      let distanceWeight = this.pos.getRangeTo(drop)
      let priority = amountWeight + distanceWeight - 20 // -bias for energy on ground
      energyLists.push({id: drop.id, type: 'dropped_energy', priority: priority})
    }

    let sources = _.filter(village.sources, (s) => s.energy && !s.pos.findInRange(FIND_HOSTILE_CREEPS, 5).length)
    let harvestTime = (this.carryCapacity - this.carry.energy) / (this.getActiveBodyparts(WORK) * 2)
    for (const source of sources) {
      let freeTiles = source.room.lookForAtArea(LOOK_TERRAIN, source.pos.y-1, source.pos.x-1, source.pos.y+1, source.pos.x+1, true)
      freeTiles = _.sum(freeTiles, (t) => t.terrain !== 'wall')
      freeTiles -= _.sum(village.creeps, (c) => c.memory.energy && c.memory.energy.id == source.id)
      if (freeTiles > 0 && this.getActiveBodyparts(WORK)) {
        let priority = (this.pos.getRangeTo(source) * 2) + harvestTime
        energyLists.push({id: source.id, type: 'source', priority: priority})
      }
    }

    if (village.storage && this.memory.assignment.type !== JOB.STORAGE) {
      let amountWeight = (village.storage.store.energy / this.carryCapacity) < 1 ? 99 : 0 //low priority if it cannot fill the creep carry capacity
      let distanceWeight = this.pos.getRangeTo(village.storage) * 3
      let priority = amountWeight + distanceWeight
      energyLists.push({id: village.storage.id, type: 'structure', priority: priority})
    }

    for (const container of village.sourceContainers) {
      let amountWeight = (container.store.energy / this.carryCapacity) < 1 ? 99 : 0 //low priority if it cannot fill the creep carry capacity
      let distanceWeight = this.pos.getRangeTo(container) * 2
      let priority = amountWeight + distanceWeight
      energyLists.push({id: container.id, type: 'structure', priority: priority})
    }

    if ([JOB.UPGRADE, JOB.WORSHIP].includes(this.memory.assignment.type)) {
      for (const s of village.controllerContainers) {
        let amountWeight = (s.store.energy / this.carryCapacity) < 1 ? 99 : 0 //low priority if it cannot fill the creep carry capacity
        let distanceWeight = this.pos.getRangeTo(s)
        let priority = amountWeight + distanceWeight
        energyLists.push({id: s.id, type: 'structure', priority: priority})
      }
    }

    for (const tomb of _.filter(village.tombstones, (t) => t.store.energy)) {
      let amountWeight = (tomb.store.energy / this.carryCapacity) < 1 ? 5 : 0 //low priority if it cannot fill the creep carry capacity
      let distanceWeight = this.pos.getRangeTo(tomb) * 2
      let priority = amountWeight + distanceWeight
      energyLists.push({id: tomb.id, type: 'structure', priority: priority})
    }

    let supplier = _.sortBy(energyLists, (e) => e.priority).shift()
    if (supplier) {
      this.memory.energy.id = supplier.id
      this.memory.energy.type = supplier.type
    }
    else {
      this.memory.action = 'working'
      this.memory.energy = {}
    }
  }

  let target = Game.getObjectById(this.memory.energy.id)
  switch (this.memory.energy.type) {
    case 'dropped_energy':
      if (this.pickup(target) == ERR_NOT_IN_RANGE) {
        this.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
      }
      break;
    case 'source':
      let result = this.harvest(target)
      if (result == ERR_NOT_IN_RANGE || result == ERR_NOT_ENOUGH_RESOURCES) {
        this.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
      }
      break;
    case 'structure':
      if (this.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        this.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
      }
      break;
    default:
      console.log(`${this.name}: invalid energy.type: ${this.memory.energy.type}`);
  }
  if (!target || (target.store && target.store.energy == 0) || target.energy === 0) {
    this.memory.energy = {} // reset the energy source
  }
};

function runCivilian(creep){
  if (creep.memory.assignment.type != JOB.INTER_ROOM_TRANSFER) {
    if (creep.room.name !== creep.memory.assignment.room) {
      let routes = Game.map.findRoute(creep.room, creep.memory.assignment.room)
      if (routes.length) {
        const exit = creep.pos.findClosestByPath(routes[0].exit)
        creep.moveTo(exit, {reusePath: 50, ignoreCreeps: true, visualizePathStyle: {stroke: '#AB7100', opacity: 0.3}});
      }
    }
    else {
      if (creep.memory.action != 'getEnergy' && creep.carry.energy == 0 && creep.memory.role != FARMER) {
        creep.memory.action = 'getEnergy'
      }
      if (creep.memory.action == 'getEnergy' && creep.carry.energy == creep.carryCapacity) {
        creep.memory.action = 'working'
        creep.memory.energy = {}
      }
      if (creep.creepCost() > creep.room.energyCapacityAvailable && creep.ticksToLive < 200 && villages[creep.room.name].spawns.length) {
        creep.memory.action = 'renew'
        creep.memory.energy = {}
      }

      switch (creep.memory.action) {
        case 'getEnergy':
          creep.eatBreakfast()
        break;
        case 'working':
          // Do assignment
          if (CIVILIAN_ROLE[creep.memory.assignment.type]) {
            CIVILIAN_ROLE[creep.memory.assignment.type](creep)
          }
          else {
            delete creep.memory.assignment
          }
        break;
        case 'renew':
          creep.renewSelf()
        break;
        default:
          console.log(`${creep.name} received unexpected action.`);
          console.log(creep.memory.action);
          creep.memory.action = 'working'
      }
    }
  }
  else {
    // only for inter room caravan
    CIVILIAN_ROLE[creep.memory.assignment.type](creep)
  }
}

function runMilitary(creep){
  const MILITARY_ROLE = {
    melee: require('role.meleeCombatant'),
    range: require('role.rangedCombatant')
  }

  let nearbyEnemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4)
  if (creep.room.name !== creep.memory.assignment.room && !nearbyEnemies.length) {
    // Move to destination room
    let pos = new RoomPosition(25, 25, creep.memory.assignment.room)
    creep.moveTo(pos, {reusePath: 50, ignoreCreeps: true, visualizePathStyle: {stroke: '#AB2626', opacity: 0.3}});
  }
  else {
    // Run combat code
    MILITARY_ROLE[creep.memory.role](creep)
  }
}

function supplyEnergy(creep){
  let target = Game.getObjectById(creep.memory.assignment.id)
  if (target.energyCapacity && target.energy == target.energyCapacity) {
    delete creep.memory.assignment
  }
  else {
    let result = creep.transfer(target, RESOURCE_ENERGY)
    if(result == ERR_NOT_IN_RANGE) {
      creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
    }
    else {
      delete creep.memory.assignment
    }
  }
}

function buildStructure(creep){
  let target = Game.getObjectById(creep.memory.assignment.id)
  let result = creep.build(target)
  if (result == ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}})
  }
  else if (result != OK) {
    Memory.rooms[creep.room.name].newBuilding = true
    delete creep.memory.assignment
  }
}

function repairStructure(creep){
  let target = Game.getObjectById(creep.memory.assignment.id)
  let result = creep.repair(target)
  if (result == ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}})
  }
  if (!target || target.hits == target.hitsMax) {
    delete creep.memory.assignment
  }
}

function improveController(creep){
  let controller = Game.getObjectById(creep.memory.assignment.id)
  let result = creep.upgradeController(controller)
  if (result == ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffffff'}});
  }
  else if (result != OK || creep.carry.energy <= creep.getActiveBodyparts(WORK)) {
    delete creep.memory.assignment
  }
  let num = Math.floor(Math.random() * 10)
  if (num == Game.time % 10) {
    creep.say('iä! iä!', true)
  }
}

function worship(creep) {
  let altar = Game.getObjectById(creep.memory.assignment.id)
  let result = creep.upgradeController(altar)
  if (result == ERR_NOT_IN_RANGE) {
    creep.moveTo(altar, {visualizePathStyle: {stroke: '#ffffff'}});
  }
  else {
    let num = Math.floor(Math.random() * 3)
    if (num == 0) {
      creep.say('iä! iä!', true)
    }
  }
}

function interRoomCaravan(creep) {
  if (creep.memory.action != 'getEnergy' && creep.carry.energy == 0) {
    creep.memory.action = 'getEnergy'
  }
  if (creep.memory.recycle || creep.memory.action == 'getEnergy' && creep.carry.energy == creep.carryCapacity) {
    creep.memory.action = 'working'
    creep.memory.energy = {}
  }
  let target
  switch (creep.memory.action) {
    case 'getEnergy':
      target = Game.getObjectById(creep.memory.assignment.id)
      if (!target) {
        creep.moveTo(Game.flags[creep.memory.assignment.flag], {reusePath: 50, ignoreCreeps: true})
      }
      else if (creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        let shouldIgnore = creep.room.name != target.room.name
        creep.moveTo(target, {ignoreCreeps: shouldIgnore, visualizePathStyle: {stroke: '#ffaa00'}});
      }
      break;
    case 'working':
      target = Game.rooms[creep.memory.base].storage
      let energy = creep.carry.energy
      let result = creep.transfer(target, RESOURCE_ENERGY)
      if(result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {reusePath: 20, ignoreCreeps: true, visualizePathStyle: {stroke: '#ffffff'}});
      }
      else if (result == OK) {
        Memory.stats.remoteMining[creep.memory.assignment.room].income += energy
        creep.memory.recycle = Game.flags[creep.memory.assignment.flag].memory.roundTripLength + 10 > creep.ticksToLive
      }

      // Recycle if no energy
      if (creep.memory.recycle && !energy) {
        let spawn = Game.rooms[creep.memory.base].find(FIND_MY_SPAWNS)[0]
        let result = spawn.recycleCreep(creep)
        if (result == ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn, {reusePath: 20, ignoreCreeps: true, visualizePathStyle: {stroke: '#ffffff'}});
        }
      }
      break;
    default:
      console.log(`inter room caravan ${creep.name} with unexpected action: ${creep.memory.action}`);
  }
}

Creep.prototype.creepCost = function () {
  let cost = 0
  for (const part of this.body) {
    cost += BODYPART_COST[part.type]
  }
  return cost
};

Creep.prototype.renewSelf = function () {
  let spawn = this.pos.findClosestByRange(FIND_MY_SPAWNS)
  let result = spawn.renewCreep(this)
  if (result == ERR_NOT_IN_RANGE) {
    this.moveTo(spawn)
  }
  if (this.ticksToLive > 1400 || result == ERR_NOT_ENOUGH_ENERGY) {
    this.memory.action = 'working'
  }
  if (Game.time % 3 == 0) {
    this.say('♻')
  }
}
