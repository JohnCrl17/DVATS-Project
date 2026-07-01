<?php
include 'db_connect.php';

// SQL query to count all rows in your new table
$sql = "SELECT COUNT(*) as total FROM lto_clients";
$result = $conn->query($sql);

$totalClients = 0;
if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $totalClients = $row['total'];
}

// Close connection
$conn->close();

// Now you can use $totalClients in your HTML
?>