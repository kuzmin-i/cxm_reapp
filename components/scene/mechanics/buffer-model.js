import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";
import useStatusStore from "../../../store/status-store";
import unpackZipScene from "./hooks/unpack-zip-scene";
import handleAddingScene from "./hooks/handle-adding-scene";
import { v4 as uuidv4 } from "uuid";

const BufferModel = ({ path, index, layerName, setPreviewImage }) => {
  const [loaded, setLoaded] = useState(false);
  const [fetched, SetFetched] = useState(false);

  const loadingFileIndex = useStatusStore(
    ({ loadingFileIndex }) => loadingFileIndex
  );
  const setLoadingFileIndex = useStatusStore(
    ({ setLoadingFileIndex }) => setLoadingFileIndex
  );

  const setNeedsRender = useStatusStore(({ setNeedsRender }) => setNeedsRender);

  /* Глоб хук: Слои */
  const layersData = useStatusStore(({ layersData }) => layersData);
  const setLayersData = useStatusStore(({ setLayersData }) => setLayersData);

  /* Глоб хук */
  const metaData = useStatusStore(({ metaData }) => metaData);
  const setMetaData = useStatusStore(({ setMetaData }) => setMetaData);

  /* Глоб хук: bounding box */
  const boundingBox = useStatusStore(({ boundingBox }) => boundingBox);
  const setBoundingBox = useStatusStore(({ setBoundingBox }) => setBoundingBox);

  const initialZoomId = useStatusStore(({ initialZoomId }) => initialZoomId);
  const setInitialZoomId = useStatusStore(
    ({ setInitialZoomId }) => setInitialZoomId
  );

  /* Глоб хук: link structure */
  const linksStructure = useStatusStore(({ linksStructure }) => linksStructure);
  const setLinksStructure = useStatusStore(
    ({ setLinksStructure }) => setLinksStructure
  );

  const setLayersUpdated = useStatusStore(
    ({ setLayersUpdated }) => setLayersUpdated
  );

  const setLoadingFilesDownload = useStatusStore(
    ({ setLoadingFilesDownload }) => setLoadingFilesDownload
  );

  const setLoadingFilesUnarchive = useStatusStore(
    ({ setLoadingFilesUnarchive }) => setLoadingFilesUnarchive
  );

  const setLoadingFilesDownloadTotal = useStatusStore(
    ({ setLoadingFilesDownloadTotal }) => setLoadingFilesDownloadTotal
  );

  const setLoadingMetadata = useStatusStore(
    ({ setLoadingMetadata }) => setLoadingMetadata
  );

  const setLoadingThreeJS = useStatusStore(
    ({ setLoadingThreeJS }) => setLoadingThreeJS
  );

  const {
    loadingFilesDownload,
    loadingFilesUnarchive,
    loadingFilesDownloadTotal,
    loadingMetadata,
    loadingThreeJS,
    loadingAuth,
    loadingDataSceneSanity,
    loadingDataThumbnail,
  } = useStatusStore();

  const filesTab = "По файлам";
  const materialsTab = "По цветам";

  const [dataGeometry, setDataGeometry] = useState(null);

  const {
    scene,
    camera,
    size: { width, height },
    gl,
  } = useThree();

  /* Шаг 1: Загрузить данные ключа */
  useEffect(() => {
    if (!fetched && index === loadingFileIndex) {
      const fetchMethod = "zip"; // zip | json

      if (fetchMethod === "zip") {
        /* в случае ошибки переходим к следующему ключу */
        const onFailing = () => {
          setLoadingFileIndex(loadingFileIndex + 1);
          SetFetched(true);
        };

        unpackZipScene({
          path,
          setDataGeometry,
          SetFetched,
          onFailing,
          setLoadingFilesDownload,
          setLoadingFilesDownloadTotal,
          setLoadingFilesUnarchive,
          loadingFilesDownload,
          loadingFilesUnarchive,
          loadingFilesDownloadTotal,
        });
      }
    }
  }, [path, index, loadingFileIndex, fetched]);

  /* Управление вкладкой "По файлам */
  const handleFilesLayers = () => {
    let layersData_copy = layersData;
    if (!layersData_copy[filesTab]) {
      layersData_copy[filesTab] = [];
    }

    layersData_copy[filesTab].push({ name: layerName, visible: true });

    setLayersData(layersData_copy);
    setLayersUpdated(true);
  };

  const handleZoomingToBox = (objBox) => {
    if (objBox) {
      console.log({ objBox });
      camera.zoom =
        Math.min(
          width / (objBox.max.x - objBox.min.x) / 1.5,
          height / (objBox.max.y - objBox.min.y) / 1.5
        ) / 1.5;
      camera?.updateProjectionMatrix();
    }
  };

  const handleBoundingBox = (bbox) => {
    if (bbox) {
      if (!boundingBox) {
        setBoundingBox({ ...bbox, id: uuidv4() });
      } else {
        let { min: _min = {}, max: _max = {} } = boundingBox;
        let min = { ..._min };
        let max = { ..._max };

        /* min */
        if (bbox.min.x < min.x) min.x = bbox.min.x;
        if (bbox.min.y < min.y) min.y = bbox.min.y;
        if (bbox.min.z < min.z) min.z = bbox.min.z;

        /* max */
        if (bbox.max.x > max.x) max.x = bbox.max.x;
        if (bbox.max.y > max.y) max.y = bbox.max.y;
        if (bbox.max.z > max.z) max.z = bbox.max.z;

        setBoundingBox({ min, max, id: uuidv4() });
      }
    }
  };

  const handleMetaData = (metadata = {}) => {
    let metadataStart = performance.now();
    let metaData_copy = metaData;

    /* Добавляем версионность, чтобы отслеживать обновления */
    const version_tag = "__v";

    if (!metaData_copy[version_tag]) {
      metaData_copy[version_tag] = 0;
    } else {
      metaData_copy[version_tag] += 1;
    }

    Object.keys(metadata).map((name) => {
      const item = metadata[name];

      if (typeof item === "number" || typeof item === "string") {
        if (!metaData_copy[name]) {
          metaData_copy[name] = [];
        }

        const foundSameType = metaData_copy[name].find(
          ({ type }) => type === `${item}`
        );

        if (!foundSameType) {
          metaData_copy[name].push({ type: `${item}`, value: 1 });
        } else {
          metaData_copy[name] = metaData_copy[name].map((item = {}) => {
            const { value, type } = item;

            if (type === `${item}`) {
              return { type, value: value + 1 };
            } else {
              return item;
            }
          });
        }
      } else if (name === "material" && Array.isArray(item)) {
        if (!metaData_copy[name]) {
          metaData_copy[name] = [];
        }

        const [color] = item ? item : [];
        const [r, g, b, opacity] = Array.isArray(color) ? color : [];
        const colorString = `${r}^${g}^${b}^${opacity}`;

        const foundSameType = metaData_copy[name].find(
          ({ type }) => type === `${colorString}`
        );

        if (!foundSameType) {
          metaData_copy[name].push({ type: `${colorString}`, value: 1 });
        } else {
          metaData_copy[name] = metaData_copy[name].map((item = {}) => {
            const { value, type } = item;

            if (type === `${colorString}`) {
              return { type, value: value + 1 };
            } else {
              return item;
            }
          });
        }
      }
      //else
    });

    setMetaData(metaData_copy);
    let metadataEnd = performance.now();
    setLoadingMetadata(metadataEnd - metadataStart);
  };

  /* Управление вкладкой "По цветам" */
  const handleColorsLayer = (colors = {}) => {
    let layersData_copy = layersData;

    if (!layersData_copy[materialsTab]) {
      layersData_copy[materialsTab] = [];
    }

    Object.keys(colors).map((color) => {
      const findColor = layersData_copy[materialsTab].find((item = {}) => {
        const { name } = item;

        if (name === color) {
          return true;
        }

        return false;
      });

      if (!findColor) {
        layersData_copy[materialsTab].push({ name: color, visible: true });
      }
    });

    setLayersData(layersData_copy);
    setLayersUpdated(true);
  };

  /* Шаг 2: Распределить метаданные по слоям */
  useEffect(() => {
    if (fetched) {
      handleFilesLayers();
    }
  }, [fetched]);

  useEffect(() => {
    if (!loaded) {
      setLoadingThreeJS(0);
      let sceneAddingStart = performance.now();

      if (dataGeometry && index === loadingFileIndex) {
        /* Шаг 3: Если нужно превратить данные в mesh и для всех случаев добавить в сцену */
        handleAddingScene({
          dataGeometry,
          handleMetaData,
          handleColorsLayer,
          layerName,
          scene,
          setLinksStructure,
          linksStructure,
          initialZoomId,
          setBoundingBox,
          handleZoomingToBox,
        });

        setNeedsRender(true);

        setLoaded(true);
        setLoadingFileIndex(loadingFileIndex + 1);
      }
      let sceneAddingEnd = performance.now();
      setLoadingThreeJS(loadingThreeJS + (sceneAddingEnd - sceneAddingStart));
    }
  }, [loaded, dataGeometry, index, loadingFileIndex, layerName]);

  useEffect(() => {
    if (loaded) {
      const screenshot = gl?.domElement.toDataURL("image/jpeg", 0.5);
      if (setPreviewImage) {
        setPreviewImage(screenshot);
        //let img = new Image();
        //img.src = screenshot;
        //let w = window.open("", "");
        //w.document.body.appendChild(img);
      }

      console.log(
        `
          %cLoading complete!\n
          Results:\n\n
          Total time: ${
            loadingAuth +
            loadingFilesDownloadTotal +
            loadingMetadata +
            loadingThreeJS +
            loadingDataSceneSanity +
            loadingDataThumbnail
          }ms;\n
          Authorisation: ${loadingAuth}ms;\n
          Files downloaded: ${loadingFilesDownload}ms;\n
          Files unarchived: ${loadingFilesUnarchive}ms;\n
          Files download + unarchivation: ${loadingFilesDownloadTotal}ms;\n
          Files metadata update: ${loadingMetadata}ms;\n
          Files added to three.js scene: ${loadingThreeJS}ms;\n
`,
        "color: green; font-weight: bold;"
      );
    }
  }, [loaded]);

  return <></>;
};

export default BufferModel;

/* F1 */
//THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
//THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
//THREE.Mesh.prototype.raycast = acceleratedRaycast;

//geometry.computeBoundsTree();

/* F2 */
/*if (fetchMethod === "json") {
        
        fetch(path)
          .then((response) => {
            return response.json();
          })
          .then((responseJSON) => {
           

            setDataGeometry(responseJSON);
            SetFetched(true);
          })
          .catch((error) => {
            setLoadingFileIndex(loadingFileIndex + 1);
            SetFetched(true);
          });
      } else 
      */
