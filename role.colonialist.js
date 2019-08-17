module.exports = function(creep) {
  // Move creep to target room
  if (creep.room.name !== creep.memory.assignment.room) {
    let routes = Game.map.findRoute(creep.room, creep.memory.assignment.room)
    if (routes.length) {
      const exit = creep.pos.findClosestByPath(routes[0].exit)
      creep.moveTo(exit, {visualizePathStyle: {stroke: '#E547F2'}});
    }
  }
  else {
    let controller = creep.room.controller
    if (creep.reserveController(controller) == ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {visualizePathStyle: {stroke: '#E547F2'}});
      if (Game.time % 3 == 0) {
        creep.say('🏴', true)
      }
    }
    else {
      const SAY = {
        0: `Iä Nyar-`,
        1: `-lathotep!`,
        2: `Iä Iä`,
        3: 'O Crawling',
        4: `Chaos!`
      }
      let txt = SAY[Game.time % 10]
      if(txt) creep.say(txt, true)
    }
  }
};
