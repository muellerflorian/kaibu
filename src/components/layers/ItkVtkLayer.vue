<template>
  <div class="itk-vtk-layer">
    <section>
      <input
        ref="file_input"
        @change="resolveFiles && resolveFiles($event)"
        type="file"
        style="display:none;"
        multiple
      />

      <b-button
        v-if="showLoadButton"
        @click="$refs.file_input.click()"
        icon-left="file-import"
      >
        Load File(s)
      </b-button>
    </section>
    <b-field v-if="layer" label="opacity">
      <b-slider
        v-model="config.opacity"
        @input="updateOpacity"
        :min="0"
        :max="1.0"
        :step="0.1"
      ></b-slider>
    </b-field>
    <section
      :id="'itk-vtk-control_' + config.id"
      style="position: relative;"
    ></section>
  </div>
</template>

<script>
import { Map } from "ol";
import { Pointer } from "ol/interaction";
import Layer from "ol/layer/Layer";

const itkVtkViewer = window.itkVtkViewer;

const CanvasLayer = /*@__PURE__*/ (function(Layer) {
  function CanvasLayer(options) {
    options = options || {};
    Layer.call(this, options);
    this.viewerElement = document.createElement("div");
    this.viewerElement.classList.add("ol-layer");
    this.viewerElement.style.position = "absolute";
    this.viewerElement.style.width = "100%";
    this.viewerElement.style.height = "100%";
    this.sync_callback = options.sync_callback;
  }

  if (Layer) CanvasLayer.__proto__ = Layer;
  CanvasLayer.prototype = Object.create(Layer && Layer.prototype);
  CanvasLayer.prototype.constructor = CanvasLayer;

  CanvasLayer.prototype.getSourceState = function getSourceState() {
    return "ready";
  };

  CanvasLayer.prototype.render = function render() {
    if (this.sync_callback) {
      this.sync_callback();
    }
    this.viewerElement.style.opacity = this.getOpacity();
    return this.viewerElement; //return the viewer element
  };

  return CanvasLayer;
})(Layer);

function convertImageUrl2Itk(url) {
  return new Promise(resolve => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.onload = function() {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0, image.width, image.height);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      resolve({
        imageType: {
          dimension: 2,
          pixelType: 1,
          componentType: "uint8_t",
          components: 4
        },
        name: "test image",
        origin: [0, 0],
        spacing: [1, 1],
        direction: { data: [1, 0, 0, 1] },
        size: [image.width, image.height],
        data: new Uint8Array(imageData.data.buffer)
      });
    };
    image.crossOrigin = "Anonymous";
    image.src = url;
  });
}

// eslint-disable-next-line no-unused-vars
function generateData3D() {
  const size = [100, 100, 100];
  const imgArray = new Uint16Array(new ArrayBuffer(100 * 100 * 100 * 2));
  for (let i = 0; i < 100 * 100 * 100; i++) {
    imgArray[i] = Math.floor(Math.random() * Math.floor(65535));
  }
  const imageData = itkVtkViewer.utils.vtkITKHelper.convertItkToVtkImage({
    imageType: {
      dimension: 3,
      pixelType: 1,
      componentType: "uint16_t",
      components: 1
    },
    name: "test image",
    origin: [0, 0, 0],
    spacing: [1, 1, 1],
    direction: { data: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    size: size,
    data: imgArray
  });
  return imageData;
}

export default {
  name: "itk-vtk-layer",
  type: "itk-vtk",
  show: true,
  props: {
    map: {
      type: Map,
      default: null
    },
    selected: {
      type: Boolean,
      default: false
    },
    visible: {
      type: Boolean,
      default: false
    },
    config: {
      type: Object,
      default: function() {
        return {};
      }
    }
  },
  data() {
    return {
      layer: null,
      mode: "2D",
      resolveFiles: null,
      showLoadButton: false
    };
  },
  watch: {
    visible: function(newVal) {
      this.layer.setVisible(newVal);
      this.$forceUpdate();
    }
  },
  mounted() {
    this.config.name = this.config.name || "itk-vtk image";
    this.config.opacity = 1.0;
    // this.config.sliders = [
    //   {
    //     name: "T",
    //     min: 0,
    //     max: 100,
    //     step: 1,
    //     value: 3,
    //     changed() {
    //       console.log("t slider changed.");
    //     }
    //   }
    // ];
    this.config.init = this.init;
  },
  beforeDestroy() {
    if (this.layer) {
      this.map.removeLayer(this.layer);
    }
  },
  created() {},
  methods: {
    async init() {
      this.layer = await this.setupLayer();
      this.map.addLayer(this.layer);
      this.$forceUpdate();
      return this.layer;
    },
    updateOpacity() {
      if (this.layer) this.layer.setOpacity(this.config.opacity);
    },
    selectLayer() {},
    async normalizeImage(data) {
      let imageData;
      if (typeof data === "object") {
        imageData = data;
        if (imageData._rtype && imageData._rtype === "ndarray") {
          imageData = itkVtkViewer.utils.ndarrayToItkImage(imageData);
          // TODO: fix direction to be inline with Fiji
          // if (imageData.imageType.dimension === 2) {
          //   imageData.direction.data = [1, 0, 0, -1];
          // } else if (imageData.imageType.dimension === 3) {
          //   imageData.direction.data = [1, 0, 0, 0, -1, 0, 0, 0, 1];
          // }
        }
      } else if (typeof data === "string")
        imageData = await convertImageUrl2Itk(data);

      // this.config.name = this.config.type;
      // this.config.data =
      //   "https://images.proteinatlas.org/19661/221_G2_1_red_green.jpg";
      // imageData = await convertImageUrl2Itk(this.config.data);
      const vtkImage = itkVtkViewer.utils.vtkITKHelper.convertItkToVtkImage(
        imageData
      );
      return vtkImage;
    },
    async setupLayer() {
      const containerStyle = {
        position: "absolute",
        width: "100vw",
        height: "100vh",
        minHeight: "400px",
        minWidth: "400px",
        margin: "1",
        padding: "1",
        top: "0",
        left: "0",
        overflow: "hidden",
        display: "block-inline"
      };
      const viewerStyle = {
        backgroundColor: [0, 0, 0, 0],
        containerStyle: containerStyle
      };

      var itk_layer = new CanvasLayer();

      let viewer, extent, is2D;
      if (
        this.config.data &&
        !(this.config.data instanceof FileList) &&
        !(this.config.data instanceof File)
      ) {
        const vtkImage = await this.normalizeImage(this.config.data);

        const extent_3d = vtkImage.getExtent();

        const dims = vtkImage.getDimensions();
        is2D = dims.length === 2 || (dims.length === 3 && dims[2] === 1);
        viewer = itkVtkViewer.createViewer(itk_layer.viewerElement, {
          viewerStyle: viewerStyle,
          image: vtkImage,
          pointSets: null,
          geometries: null,
          use2D: is2D,
          rotate: false,
          uiContainer: document.getElementById(
            "itk-vtk-control_" + this.config.id
          )
        });
        //TODO: udpate the extent when selecting different plane
        extent = [extent_3d[0], extent_3d[2], extent_3d[1], extent_3d[3]];
      } else {
        let files;
        if (this.config.data instanceof File) {
          files = [this.config.data];
        } else if (this.config.data instanceof FileList) {
          files = this.config.data;
        } else files = await this.getFiles();

        try {
          this.$emit("loading", true);
          const cfg = await itkVtkViewer.utils.readFiles({ files: files });
          cfg.uiContainer = document.getElementById("toolbar");
          is2D = cfg.use2D;
          cfg.uiContainer = document.getElementById(
            "itk-vtk-control_" + this.config.id
          );
          viewer = itkVtkViewer.createViewer(itk_layer.viewerElement, cfg);
          const vs = viewer
            .getViewProxy()
            .getRenderer()
            .getVolumes();
          if (vs.length > 0) {
            const extent_3d = vs[0].getBounds();
            extent = [extent_3d[0], extent_3d[2], extent_3d[1], extent_3d[3]];
          } else {
            console.warn("Extent is not set.");
            extent = [0, 0, 100, 100];
          }
        } finally {
          this.$emit("loading", false);
        }
      }
      if (!viewer) throw "Failed to load itk-vtk-viewer";
      this.config.name = this.config.name || this.config.type;
      const viewProxy = viewer.getViewProxy();
      const renderWindow = viewProxy.getRenderWindow();
      renderWindow.getViews()[0].initialize();
      // viewer.setViewMode('ZPlane');
      this.viewProxy = viewer.getViewProxy();
      this.viewProxy.updateOrientation(2, 1, [0, 1, 0]);
      this.renderWindow = this.viewProxy.getRenderWindow();
      this.interactor = this.renderWindow.getInteractor();
      if (is2D) this.enableSync(itk_layer);
      this.renderer = this.viewProxy.getRenderer();
      viewer.setUserInterfaceCollapsed(true);
      setTimeout(() => {
        viewer.setUserInterfaceCollapsed(false);
      }, 10);
      this.viewer = viewer;
      this.$emit("update-extent", { id: this.config.id, extent: extent });

      itk_layer.getLayerAPI = this.getLayerAPI;

      // since setVisible(false) will remove the canvas entirely
      // here we use opacity as an workaround for visibility setting
      itk_layer.setVisible = newVal => {
        if (!newVal) {
          this._lastOpacity = this.config.opacity;
          this.config.opacity = 0;
        } else {
          if (this._lastOpacity) this.config.opacity = this._lastOpacity;
          else this.config.opacity = 1;
        }
        this.layer.setOpacity(this.config.opacity);
      };

      return itk_layer;
    },
    getLayerAPI() {
      const me = this;
      return {
        _rintf: true,
        name: this.config.name,
        id: this.config.id,
        async set_image(image) {
          const vtkImage = await me.normalizeImage(image);
          me.viewer.setImage(vtkImage);
        }
      };
    },
    getFiles() {
      return new Promise(resolve => {
        this.showLoadButton = true;
        this.resolveFiles = event => {
          resolve(event.target.files);
          this.resolveFiles = null;
          this.showLoadButton = false;
        };
      });
    },
    enableSync(itk_layer) {
      const view = this.interactor.getView();
      // we will disable the wheel and mousedown event,
      // but keep mouse move for the corner annotation
      view
        .getContainer()
        .removeEventListener("wheel", this.interactor.handleWheel);
      view
        .getContainer()
        .removeEventListener("mousedown", this.interactor.handleMouseDown);
      itk_layer.sync_callback = this.synchronizeVtkCoordinate;

      this.enableItkInteraction();
      this.renderWindow.render();
    },
    disableSync(itk_layer) {
      if (itk_layer.sync_callback) {
        itk_layer.sync_callback = null;

        const view = this.interactor.getView();

        // we will disable the wheel and mousedown event,
        // but keep mouse move for the corner annotation
        view
          .getContainer()
          .addEventListener("wheel", this.interactor.handleWheel);
        view
          .getContainer()
          .addEventListener("mousedown", this.interactor.handleMouseDown);
      }
      this.disableItkInteraction();
    },
    convertCoordinates(x, y) {
      const view = this.interactor.getView();
      const renderPosition = { x: x, y: y };
      const bounds = view.getContainer().getBoundingClientRect();
      const canvas = view.getCanvas();
      const scaleX = canvas.width / bounds.width;
      const scaleY = canvas.height / bounds.height;
      // recover mouse clientX and clientY: https://kitware.github.io/vtk-js/api/Rendering_Core_RenderWindowInteractor.html
      const map_pixel_pos = this.map.getEventPixel({
        clientX: renderPosition.x / scaleX + bounds.left,
        clientY: bounds.height - renderPosition.y / scaleY + bounds.top
      });
      const mapPosition = this.map.getCoordinateFromPixelInternal(
        map_pixel_pos
      );
      // const projection = this.map.getProjection();
      const c = itkVtkViewer.utils.vtkCoordinate.newInstance();
      c.setRenderer(this.renderer);
      c.setCoordinateSystemToDisplay();
      c.setValue(renderPosition.x, renderPosition.y);
      const worldPosition = c.getComputedWorldValue();
      return { mapPosition: mapPosition, worldPosition: worldPosition };
    },
    synchronizeMapCoordinate() {
      const map_veiw = this.map.getView();
      const resolution = map_veiw.getResolution();
      const center = map_veiw.getCenter();
      const p1 = this.convertCoordinates(0, 0);
      const p2 = this.convertCoordinates(1, 1);
      const res_factor = resolution / (p1.mapPosition[0] - p2.mapPosition[0]);
      const new_res = Math.abs(
        (p1.worldPosition[0] - p2.worldPosition[0]) * res_factor
      );
      if (new_res !== 0 && new_res !== resolution) {
        map_veiw.setResolution(new_res);
      }
      const diff_x = p1.worldPosition[0] - p1.mapPosition[0];
      const diff_y = p1.worldPosition[1] - p1.mapPosition[1];
      map_veiw.setCenter([center[0] + diff_x, center[1] + diff_y]);
    },
    synchronizeVtkCoordinate() {
      const camera = this.viewProxy.getCamera();
      // const map_veiw = this.map.getView();
      // const center = map_veiw.getCenter();
      // const viewTranslation = camera.getPhysicalTranslation();
      const pscale = camera.getParallelScale();
      const p1 = this.convertCoordinates(0, 0);
      const p2 = this.convertCoordinates(100, 100);
      const scale_factor = pscale / (p1.worldPosition[0] - p2.worldPosition[0]);
      const new_scale = Math.abs(
        (p1.mapPosition[0] - p2.mapPosition[0]) * scale_factor
      );
      if (new_scale && new_scale !== pscale) {
        camera.setParallelScale(new_scale);
        this.viewProxy.updateDataProbeSize();
        this.viewProxy.updateScaleBar();
      }
      const p3 = this.convertCoordinates(0, 0);
      const diff_x = p3.worldPosition[0] - p3.mapPosition[0];
      const diff_y = p3.worldPosition[1] - p3.mapPosition[1];
      // map_veiw.setCenter([center[0]+diff_x, center[1]+diff_y]);
      const viewFocus = camera.getFocalPoint();
      const viewPoint = camera.getPosition();
      camera.setFocalPoint(
        viewFocus[0] - diff_x,
        viewFocus[1] - diff_y,
        viewFocus[2]
      );
      camera.setPosition(
        viewPoint[0] - diff_x,
        viewPoint[1] - diff_y,
        viewPoint[2]
      );
      camera.computeDistance();
      this.viewProxy.renderLater();
    },
    enableItkInteraction() {
      this.itkInteraction = new Pointer();
      this.itkInteraction.handleEvent = e => {
        this.itkInteraction.updateTrackedPointers_(e);
        const interactor = this.interactor;
        if (e.type == "pointermove") {
          interactor.handleMouseMove(e.originalEvent);
        }
        //return true means propagate the event
        return true;
      };
      this.map.addInteraction(this.itkInteraction);
    },
    disableItkInteraction() {
      if (this.itkInteraction) this.map.removeInteraction(this.itkInteraction);
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
.itk-vtk-layer > section > div > div > div > canvas {
  max-width: 100%;
  height: 140px;
}
.itk-vtk-layer > section > div {
  background: #dedddf;
}
.itk-vtk-layer > section > div:first-child {
  display: none;
}
.selected-box {
  width: 100% !important;
}
.selected-icon {
  width: 100% !important;
}
.icon-select .box {
  left: unset !important;
  top: 24px !important;
}
</style>
