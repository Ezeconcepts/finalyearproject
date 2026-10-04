import "../css/notification.css";
const Notification = ({ onConfirm, onCancel }) => {

  return (
    <>
      <>
        <div className="notifMain">
          <div className="innerNotifMain">
            <p>
              <strong>Are you sure you want to delete these files?</strong>
            </p>
            <button className="yesBtn"  onClick={onConfirm}>
              <small>Yes</small>
            </button>
            <br />
            <button className="noBtn"  onClick={onCancel}>
              <small>No</small>
            </button>
          </div>
        </div>
        <div id="overlay"></div>
      </>
    </>
  );
};
export default Notification;
