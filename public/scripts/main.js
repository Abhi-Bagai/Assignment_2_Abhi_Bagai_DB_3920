document.addEventListener('DOMContentLoaded', () => {
    const newChatButton = document.getElementById('newChatButton');
    const newChatModal = document.getElementById('newChatModal');
    const closeModal = document.querySelector('.close');
    const createChatButton = document.getElementById('createChatButton');

    // Open the modal
    newChatButton.addEventListener('click', () => {
        newChatModal.style.display = 'flex';
    });

    // Close the modal
    closeModal.addEventListener('click', () => {
        newChatModal.style.display = 'none';
    });

    // Close modal on background click
    window.addEventListener('click', (event) => {
        if (event.target === newChatModal) {
            newChatModal.style.display = 'none';
        }
    });

    // Handle creating a new chat
    createChatButton.addEventListener('click', async (event) => {
        event.preventDefault();

        const newChatName = document.getElementById('newChatName').value.trim();

        if (!newChatName) {
            alert('Chat name cannot be empty!');
            return;
        }

        try {
            const response = await fetch('/Main/createNewChat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newChatName }), // Ensure key matches backend
            });

            const result = await response.json();
            if (response.ok) {
                console.log('Chat room created:', result.message);
                newChatModal.style.display = 'none';
                location.reload(); // Refresh to show the new chat
            } else {
                console.error('Failed to create chat:', result.message);
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to create chat room');
        }
    });

});

document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('addButton');
    const addMemberModal = document.getElementById('addMemberModal');
    const closeMemModal = document.getElementById('closemembermodal');
    const addMember = document.getElementById('addMember');

    // Open the modal
    addButton.addEventListener('click', () => {
        addMemberModal.style.display = 'flex';
    });

    // Close the modal
    closeMemModal.addEventListener('click', () => {
        addMemberModal.style.display = 'none';
    });

    // Close modal on background click
    window.addEventListener('click', (event) => {
        if (event.target === addMemberModal) {
            addMemberModal.style.display = 'none';
        }
    });
    

    // Handle creating a new chat
    addMember.addEventListener('click', async (event) => {
        event.preventDefault();

        const newMemberName = document.getElementById('newMemberName').value.trim();
        const groupName = document.getElementById('groupName').value.trim()
        console.log("g  ", groupName)



        if (!newMemberName) {
            alert('Member name cannot be empty!');
            return;
        }

        try {
            const response = await fetch('/Main/addNewMember/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newMemberName, groupName }), // Ensure key matches backend
            });

            const result = await response.json();
            if (response.ok) {
                console.log('Chat room created:', result.message);
                addMemberModal.style.display = 'none';
                location.reload(); // Refresh to show the new chat
            } else {
                console.error('Failed to create chat:', result.message);
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to Add new member');
        }
    });

});
