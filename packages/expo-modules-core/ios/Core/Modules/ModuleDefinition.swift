/**
 The definition of the module. It is used to define some parameters
 of the module and what it exports to the JavaScript world.
 See `ModuleDefinitionBuilder` for more details on how to create it.
 */
public final class ModuleDefinition: ObjectDefinition {
  /**
   The module's type associated with the definition. It's used to create the module instance.
   */
  var type: AnyModule.Type?

  /**
   Name of the defined module. Falls back to the type name if not provided in the definition.
   */
  var name: String

  let eventListeners: [EventListener]

  let view: AnyViewDefinition?

  /**
   Names of the events that the module can send to JavaScript.
   */
  let eventNames: [String]

  /**
   Initializer that is called by the `ModuleDefinitionBuilder` results builder.
   */
  override init(definitions: [AnyDefinition]) {
    self.name = definitions
      .compactMap { $0 as? ModuleNameDefinition }
      .last?
      .name ?? ""

    self.eventListeners = definitions.compactMap { $0 as? EventListener }

    self.view = definitions
      .compactMap { $0 as? AnyViewDefinition }
      .last

    self.eventNames = Array(
      definitions
        .compactMap { ($0 as? EventsDefinition)?.names }
        .joined()
    )

    super.init(definitions: definitions)
  }

  /**
   Sets the module type that the definition is associated with. We can't pass this in the initializer
   as it's called by the results builder that doesn't have access to the type.
   */
  func withType(_ type: AnyModule.Type) -> Self {
    self.type = type

    // Use the type name if the name is not in the definition or was defined empty.
    if name.isEmpty {
      name = String(describing: type)
    }
    return self
  }

  public override func build(appContext: AppContext) throws -> JavaScriptObject {
    let object = try super.build(appContext: appContext)

    if let viewDefinition = view {
      let reactComponentPrototype = try viewDefinition.createReactComponentPrototype(appContext: appContext)
      object.setProperty("ViewPrototype", value: reactComponentPrototype)
    }

    // Give the module object a name. It's used for compatibility reasons, see `EventEmitter.ts`.
    object.defineProperty("__expo_module_name__", value: name, options: [])

    return object
  }
}

/**
 Module's name definition. Returned by `name()` in module's definition.
 */
internal struct ModuleNameDefinition: AnyDefinition {
  let name: String
}

/**
 A definition for module's constants. Returned by `constants(() -> SomeType)` in module's definition.
 */
internal struct ConstantsDefinition: AnyDefinition {
  let body: () -> [String: Any?]
}

/**
 A definition for module's events that can be sent to JavaScript.
 */
public struct EventsDefinition: AnyDefinition {
  let names: [String]
}
