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
document.addEventListener("DOMContentLoaded", () => {
    const addButton = document.getElementById("addButton");
    const addMemberModal = document.getElementById("addMemberModal");
    const closeMemModal = document.getElementById("closemembermodal");
    const addMembers = document.getElementById("addMembers");

    // Open the modal with animation
    const openModal = () => {
        addMemberModal.classList.add("show");
        addMemberModal.classList.remove("hidden");
    };

    // Close modal with animation
    const closeModal = () => {
        addMemberModal.classList.remove("show");
        setTimeout(() => addMemberModal.classList.add("hidden"), 300); // Sync with CSS transition
    };

    // Event listeners for open/close
    addButton.addEventListener("click", openModal);
    closeMemModal.addEventListener("click", closeModal);

    // Close on background click
    window.addEventListener("click", (event) => {
        if (event.target === addMemberModal) closeModal();
    });

    // Handle form submission
    addMembers.addEventListener("click", async (event) => {
        event.preventDefault();

        const selectedUsers = Array.from(
            document.querySelectorAll('input[name="selectedUsers"]:checked')
        ).map((checkbox) => checkbox.value);

        const groupName = document.getElementById("groupName").value.trim();

        if (!groupName) {
            alert("Group name is required!");
            return;
        }

        if (selectedUsers.length === 0) {
            alert("Please select at least one user!");
            return;
        }

        // Show loading state
        addMembers.innerText = "Adding...";
        addMembers.disabled = true;

        try {
            const response = await fetch("/Main/addNewMember", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    groupName,
                    users: selectedUsers,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                console.log("Users added:", result.message);
                closeModal();
                location.reload();
            } else {
                console.error("Failed to add users:", result.message);
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Failed to add users. Please try again later.");
        } finally {
            // Reset button state
            addMembers.innerText = "Add Selected Users";
            addMembers.disabled = false;
        }
    });
});
