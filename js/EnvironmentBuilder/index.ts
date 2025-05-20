import { EnvironmentBuilder } from "./EnvironmentBuilder";

// Initialize the scene
const container = document.getElementById("container");
if (container) {
  const environmentBuilder = new EnvironmentBuilder(container);
  environmentBuilder.setSceneSize(200);
}
