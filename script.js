document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('video-player');
    const startScreenShareButton = document.getElementById('start-screen-share');
    const muteAudioButton = document.getElementById('mute-audio');
    const pausePlayButton = document.getElementById('pause-play');
    const videoQualitySelect = document.getElementById('video-quality');
    const messagesList = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message');

    // Function to handle screen sharing
    async function startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            videoPlayer.srcObject = stream;
            videoPlayer.play(); // Ensure the video starts playing
        } catch (error) {
            console.error('Error starting screen share:', error);
        }
    }

    // Function to mute audio
    function muteAudio() {
        videoPlayer.muted = !videoPlayer.muted;
    }

    // Function to pause or play video
    function pausePlay() {
        if (videoPlayer.paused) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    }

    // Function to change video quality
    function changeVideoQuality() {
        const selectedQuality = videoQualitySelect.value;
        // Logic to change video quality based on selected option
        console.log('Selected video quality:', selectedQuality);
    }

    // Function to send a message
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            const messageItem = document.createElement('li');
            messageItem.textContent = message;
            messagesList.appendChild(messageItem);
            messageInput.value = '';
        }
    }

    // Event listeners
    startScreenShareButton.addEventListener('click', startScreenShare);
    muteAudioButton.addEventListener('click', muteAudio);
    pausePlayButton.addEventListener('click', pausePlay);
    videoQualitySelect.addEventListener('change', changeVideoQuality);
    sendMessageButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
});
