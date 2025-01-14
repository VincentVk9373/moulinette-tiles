export class MoulinetteDropAsActor extends FormApplication {
  
  constructor(data) {
    super()
    this.data = data;
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "moulinette-dropas",
      classes: ["mtte", "forge", "dasactor"],
      title: game.i18n.localize("mtte.dropasActor"),
      template: "modules/moulinette-tiles/templates/dropas-actor.hbs",
      width: 420,
      height: "auto",
      closeOnSubmit: true,
      submitOnClose: false,
    });
  }
  
  getData() {
    const actorId = game.settings.get("moulinette", "tileActorId");
    const actorLink = game.settings.get("moulinette", "tileActorLink");
    const actorType = game.settings.get("moulinette", "tileActorType");

    const actors = game.actors.map( a => { return { id: a.id, name: a.name, selected: a.id == actorId } })
    const actorTypes = game.system.entityTypes.Actor.map( a => { return { id: a, name: a, selected: a == actorType } })

    return { actors: actors, actorId: actorId, actorLink: actorLink, actorTypes: actorTypes }
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    this.bringToTop()
    this.html = html
    html.find(".actions button").click(this._onAction.bind(this))
  }
  
  _onAction(event) {
    event.preventDefault();
    const source = event.currentTarget;
    if(source.classList.contains("ok")) {
      const selActorId = this.html.find(".actors").children("option:selected").val()
      const linked = this.html.find("input[type='checkbox'][name='actorLink']").prop('checked')
      const selActor = game.actors.has(selActorId) ? game.actors.get(selActorId) : null
      this.createToken(selActor, linked)
      // keep preferences
      game.settings.set("moulinette", "tileActorId", selActorId);
      game.settings.set("moulinette", "tileActorLink", linked);
    }
    else if(source.classList.contains("okNew1")) {
      this.createToken(null, false)
    } else if(source.classList.contains("okNew2")) {
      this.createToken(null, true)
    }
    this.close()
  }
  
  async createToken(actor, linked) {
    // Download asset
    const cTiles = await import("./moulinette-tiles.js")
    await cTiles.MoulinetteTiles.downloadAsset(this.data)
    
    let td = null

    // Reusing existing actor
    if(actor) {
      td = await actor.getTokenData({x: this.data.x, y: this.data.y, actorLink: linked, img: this.data.img});
    }
    // Creating new actor
    else {
      const actorType = this.html.find(".actorsTypes").children("option:selected").val()
      if(!game.system.entityTypes.Actor.includes(actorType)) {
        return console.error(`MoulinetteDropAsActor | Invalid actor type ${actorType}`, game.system.entityTypes.Actor)
      }
      // keep preferences
      game.settings.set("moulinette", "tileActorType", actorType);

      // extracts the filename and replace all filename separators by spaces
      const name = this.data.img.split("/").pop().split(".")[0].replaceAll("_", " ").replaceAll("-", " ").replace(/  +/g, ' ');
      actor = await Actor.create({
        name: name,
        type: actorType,
        img: this.data.img
      });
      td = await actor.getTokenData({x: this.data.x, y: this.data.y, actorLink: linked, img: this.data.img});

      game.settings.set("moulinette", "tileActorId", actor.id);
      game.settings.set("moulinette", "tileActorLink", linked);
    }

    // Adjust token position
    const hg = canvas.dimensions.size / 2;
    td.x -= td.width * hg;
    td.y -= td.height * hg;
    mergeObject(td, canvas.grid.getSnappedPosition(td.x, td.y)); // snap to grid
    if ( !canvas.grid.hitArea.contains(td.x, td.y) ) return false;

    // Submit the Token creation request and activate the Tokens layer (if not already active)
    let newToken = (await canvas.scene.createEmbeddedDocuments(Token.embeddedName, [td], { parent: canvas.scene }))[0]
    newToken = newToken._object

    // sometimes throws exceptions
    try {
      canvas.getLayer("TokenLayer").activate()
    } catch(e) {}
    
    // Call macro
    const macros = cTiles.MoulinetteTiles.getMacros(actor)
    for(const macro of macros) {
      game.moulinette.param = [newToken]
      macro.execute()
      delete game.moulinette.param
    }
  }    
}
