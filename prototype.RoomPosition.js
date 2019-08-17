RoomPosition.prototype.highlight = function () {
  new RoomVisual(this.roomName).rect(this.x - 0.5, this.y - 0.5, 1, 1, {fill: 'teal'})
};
