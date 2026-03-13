import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv

class CNN_LSTM_GCN(nn.Module):
    def __init__(self, num_features):
        super(CNN_LSTM_GCN, self).__init__()

        self.gcn = GCNConv(num_features, 32)

        self.conv1 = nn.Conv1d(32, 64, kernel_size=2)

        self.lstm = nn.LSTM(64, 128, batch_first=True)

        self.fc1 = nn.Linear(128, 64)
        self.fc2 = nn.Linear(64, num_features)

    def forward(self, x, edge_index):

        batch_size, seq_len, num_features = x.size()

        gcn_outputs = []

        for t in range(seq_len):
            xt = x[:, t, :]
            xt = self.gcn(xt, edge_index)
            xt = F.relu(xt)
            gcn_outputs.append(xt)

        x = torch.stack(gcn_outputs, dim=1)

        x = x.permute(0, 2, 1)
        x = self.conv1(x)
        x = F.relu(x)
        x = x.permute(0, 2, 1)

        out, _ = self.lstm(x)
        out = out[:, -1, :]

        out = F.relu(self.fc1(out))
        out = self.fc2(out)

        return out
