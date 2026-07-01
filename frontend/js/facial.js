document.addEventListener("DOMContentLoaded", () => {
    loadClientsForFace();
    startCamera();
});

function loadClientsForFace() {
    fetch("/api/clients")
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById("clientSelectFace");
            select.innerHTML = "";
            data.forEach(client => {
                const option = document.createElement("option");
                option.value = client.client_id;
                option.text = client.fullname;
                select.appendChild(option);
            });
        });
}

function startCamera() {
    const video = document.getElementById("video");
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { video.srcObject = stream; })
        .catch(err => console.error("Camera error:", err));
}

function captureFace() {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg");

    const client_id = document.getElementById("clientSelectFace").value;

    fetch("/api/facial/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, imageData })
    })
    .then(res => res.json())
    .then(data => alert(data.message))
    .catch(err => console.error(err));
}
