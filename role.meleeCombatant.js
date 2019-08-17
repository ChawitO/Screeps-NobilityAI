module.exports = function(creep) {
    // Begin combat code
    let village = villages[creep.room.name]
    let hostileCreeps = village.hostileCreeps
    let hostileStructures = village.hostileStructures
    let target

    if (hostileStructures.length) {
      target = _.filter(hostileStructures, {structureType: STRUCTURE_SPAWN})[0]
      if (!target) {
        target = creep.pos.findClosestByRange(hostileStructures, {filter: {structureType: STRUCTURE_TOWER}})
        // target = creep.pos.findClosestByRange(_.filter(hostileStructures, (s) => s.structureType != STRUCTURE_STORAGE && s.structureType != STRUCTURE_RAMPART))
      }
    }
    else {
      target = creep.pos.findClosestByRange(hostileCreeps)
    }

    if (target) {
      // Attack
      if (Game.time % 3 == 0) creep.say('En garde!', true)
      if (creep.pos.isNearTo(target)) {
        creep.say('⚔️', true)
        creep.attack(target)
        creep.moveTo(target, {visualizePathStyle: {stroke: '#A12626', opacity: 0.3}});
      }
      else {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#A12626', opacity: 0.3}});
        creep.attack(target)
      }
    }
    else {
      // Standby at controller
      let controller = creep.room.controller
      if (controller && !creep.pos.inRangeTo(controller, 5)) {
        creep.moveTo(controller, {visualizePathStyle: {stroke: '#ffffff'}});
      }
      else if (controller && (!controller.sign || controller.sign.username !== creep.owner.username)) {
        sign(creep)
      }
    }
  // creep.suicide()
};

// 7620544 battle start
function sign(creep){
  let result = creep.signController(creep.room.controller, `Iä! Iä! Cthulhu fhtagn! Ph'nglui mglw'nfah Cthulhu R'lyeh wgah'nagl fhtagn!`)
  if (result == ERR_NOT_IN_RANGE) {
    creep.say(`Iä! Iä!`, true)
    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#1E775C'}})
  }
}
