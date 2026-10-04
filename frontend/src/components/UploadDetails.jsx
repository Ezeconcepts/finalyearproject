import moment from "moment";

import { useState } from "react";

import '../css/uploadDetails.css'
const UploadDetails = ({ userFiles, onSelectionChange }) => {

  const [selectedFiles, setSelectedFiles] = useState([]);

  let selectedItems;

  const handleSubmit = (fileName, fileDate, filePath, e) => {
    const file = { fileName, fileDate, filePath };
    const updatedSelectedFiles = [...selectedFiles];

    if (e.target.checked) {
      const existingIndex = updatedSelectedFiles.findIndex(
        (f) => f.fileName === fileName && f.fileDate === fileDate
      );
      if (existingIndex === -1) {
        updatedSelectedFiles.push(file);
      }
    } else {
      const index = updatedSelectedFiles.findIndex(
        (f) => f.fileName === fileName && f.fileDate === fileDate
      );
      if (index > -1) {
        updatedSelectedFiles.splice(index, 1);
      }
    }

    selectedItems = updatedSelectedFiles.length;
    setSelectedFiles(updatedSelectedFiles);
    onSelectionChange?.(updatedSelectedFiles);
    const selectedData = JSON.stringify(updatedSelectedFiles);

    localStorage.setItem("checked", selectedData);
  };

  const handleClick = () => {
    updateDeleteButton();
    updateEncryptButton(selectedItems);
  };

  function updateDeleteButton() {
    const deleteButton = document.querySelector(".delete");
    if (!deleteButton) return;
    const selectedCount = selectedItems;
    deleteButton.textContent = `Delete files (${selectedCount})`;
    if (selectedCount != 0) {
      deleteButton.style.display = "block";
    } else {
      deleteButton.style.display = "none";
    }
  }

  function updateEncryptButton(num) {
    const encryptButton = document.querySelector(".encrypt");
    if (num == 0) {
      encryptButton.style.color = "gray";
    } else {
      encryptButton.style.color = "#162EFF";
    }
  }

  return (
    <>
      <div className="mainbarDetails">
        <div class="rowHeaders">
          <input type="checkbox" id="1" className="input-checkbox" />
          <p>Filename</p>
          <p class="size">Size</p>
          <p>Date Added</p>
        </div>
        {userFiles &&
          userFiles.map((file) => (
            <div class="row" key={file._id}>
              <input
                type="checkbox"
                className="input-checkbox"
                onClick={(e) => {
                  handleSubmit(file.fileName, file.fileDate, file.path, e);
                  handleClick();
                }}
              />

              <p>{file.fileName}</p>
              <p>{file.size}</p>

              <p>
                {moment(Number(file.fileDate)).format(
                  "DD MMMM, 2024 [at] HH:mm A"
                )}
              </p>
            </div>
          ))}
      </div>
    </>
  );
};
export default UploadDetails;
