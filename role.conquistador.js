module.exports = function(creep) {
  // Move creep to target room
  if (creep.room.name !== creep.memory.assignment.room) {
    let routes = Game.map.findRoute(creep.room, creep.memory.assignment.room)
    if (routes.length) {
      const exit = creep.pos.findClosestByPath(routes[0].exit)
      creep.moveTo(exit, {visualizePathStyle: {stroke: '#E547F2'}});
    }
  }
  else if (creep.room.name == creep.memory.assignment.room) {
    // Check if has controller id, if not get one from target room
    if (!creep.memory.assignment.id) {
      creep.memory.assignment.id = creep.room.controller.id
    }
    // Move to it and claim it
    let controller = Game.getObjectById(creep.memory.assignment.id)
    if (controller && !controller.my) {
      let result = creep.claimController(controller)
      if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, {visualizePathStyle: {stroke: '#E547F2'}});
        if (Game.time % 3 == 0) {
          creep.say('🏴', true)
        }
      }
      else if (result == OK) {
        console.log(`${creep.name} has claimed ${creep.room.name} for the Empire!`);
        delete creep.memory.assignment
      }
      else {
        if (creep.reserveController(controller) == ERR_NOT_IN_RANGE) {
          creep.moveTo(controller, {visualizePathStyle: {stroke: '#E547F2'}});
          if (Game.time % 3 == 0) {
            creep.say('🏴', true)
          }
        }
      }
    }
    if (controller && controller.my && (!controller.sign || controller.sign.username !== creep.owner.username)) {
      creep.signController(creep.room.controller, `Iä! Iä! Cthulhu fhtagn! Ph'nglui mglw'nfah Cthulhu R'lyeh wgah'nagl fhtagn!`)
      creep.say(`Iä! Iä!`, true)
    }
  }
};
