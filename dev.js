import { app, BrowserWindow, ipcMain, dialog } from "electron";
import fs from "fs";
import piexif, { TagValues } from "piexif-ts";

let defaultFolder = null;

const imageFileEndings = [".png", ".jpg", ".jpeg"];

const getFileEnding = (fileName) => {
  return fileName.slice(fileName.lastIndexOf("."));
};

const fileIsViewableImage = (fileName) => {
  const fileEnding = getFileEnding(fileName).toLowerCase();
  return imageFileEndings.includes(fileEnding);
};

const getFolders = () => {
  return fs.readdirSync(defaultFolder).filter((file) => {
    return fs.lstatSync(`${defaultFolder}\\${file}`).isDirectory();
  });
};

const moveFile = (filename, startFolder, endFolder) => {
  var oldPath = `${defaultFolder}\\${startFolder}\\${filename}`;
  var newPath = `${defaultFolder}\\${endFolder}\\${filename}`;
  fs.rename(oldPath, newPath, function (err) {
    if (err) throw err;
    console.log(
      `Successfully moved ${filename} from ${startFolder} to ${endFolder}`
    );
  });
};

const getFileNames = () => {
  const fileNames = {};
  getFolders().forEach((folder) => {
    const path = `${defaultFolder}\\${folder}`;

    if (!fileNames[folder]) {
      fileNames[folder] = [];
    }

    fs.readdirSync(path).forEach((file) => {
      if (fileIsViewableImage(file)) {
        fileNames[folder].push(file);
      }
    });
  });
  return fileNames;
};

const getImageData = (folderName, imageName) => {
  const path = `${defaultFolder}\\${folderName}\\${imageName}`;
  const raw = fs.readFileSync(path);
  const imageData = raw.toString("base64");
  const binary = raw.toString("binary");
  const exif = piexif.load(binary);
  const imageDescription = exif["0th"][TagValues.ImageIFD.ImageDescription];
  return { imageData, imageDescription };
};

const updateImageDescription = (folderName, imageName, newDescription) => {
  const path = `${defaultFolder}\\${folderName}\\${imageName}`;
  const raw = fs.readFileSync(path);
  const binary = raw.toString("binary");
  const exif = piexif.load(binary);
  exif["0th"][TagValues.ImageIFD.ImageDescription] = newDescription;
  const exifBytes = piexif.dump(exif);
  const newData = piexif.insert(exifBytes, binary);
  fs.writeFileSync(path, Buffer.from(newData, "binary"));
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadURL("http://localhost:5173/");
};

app.whenReady().then(async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select a folder for all your albums",
  });
  defaultFolder = result.filePaths[0];

  createWindow();

  ipcMain.handle("readFile", async (event, fileName) => {
    try {
      return fs.readFileSync(`${defaultFolder}${fileName}`, "utf-8");
    } catch (_) {
      console.error(`Can't find file ${fileName}`);
      return null;
    }
  });

  ipcMain.handle("getFileNames", (event) => {
    const fileNames = getFileNames();
    return fileNames;
  });

  ipcMain.handle("getImage", (event, folderName, imageName) => {
    return getImageData(folderName, imageName);
  });

  ipcMain.handle(
    "updateImageDescription",
    (event, folderName, imageName, newDescription) => {
      return updateImageDescription(folderName, imageName, newDescription);
    }
  );

  ipcMain.handle("moveImage", (event, fileName, startFolder, endFolder) => {
    return moveFile(fileName, startFolder, endFolder);
  });

  ipcMain.handle("createFolder", (event, folderName) => {
    fs.mkdirSync(`${defaultFolder}\\${folderName}`);
  });

  ipcMain.handle("renameFolder", (event, oldName, newName) => {
    fs.renameSync(
      `${defaultFolder}\\${oldName}`,
      `${defaultFolder}\\${newName}`
    );
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
